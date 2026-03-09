import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { In, MoreThan, Repository } from 'typeorm';
import { WorkflowTask } from './entities/workflow-task.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { TaskStatus, WorkflowStatus, StepType } from './enums';
import { AssignTaskDto } from './dto/assign-task.dto';
import { ClaimTaskDto } from './dto/claim-task.dto';
import { CompleteNonApprovalTaskDto } from './dto/complete-non-approval-task.dto';
import { SkipTaskDto } from './dto/skip-task.dto';
import { UpdateTaskPayloadDto } from './dto/update-task-payload.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { USER_SERVICE_CLIENT } from './constants';

// Roles that bypass per-step role restrictions
const SUPERUSER_ROLES = ['ADMIN', 'SUPER_ADMIN'];

// Terminal statuses used when bulk-cancelling remaining tasks on hard-reject
const TERMINAL_STATUSES: WorkflowStatus[] = [
  WorkflowStatus.APPROVED,
  WorkflowStatus.REJECTED,
  WorkflowStatus.CANCELLED,
];

function assertCallerRole(requiredRole: string | null, callerRole: string | undefined): void {
  if (!requiredRole) return;
  if (!callerRole || (!SUPERUSER_ROLES.includes(callerRole) && callerRole !== requiredRole)) {
    throw new RpcException({
      statusCode: 403,
      message: `Insufficient role. Required: ${requiredRole}`,
      error: 'Forbidden',
    });
  }
}

@Injectable()
export class WorkflowTaskService {
  private readonly logger = new Logger(WorkflowTaskService.name);

  constructor(
    @InjectRepository(WorkflowTask)
    private taskRepo: Repository<WorkflowTask>,
    @InjectRepository(WorkflowInstance)
    private instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowStep)
    private stepRepo: Repository<WorkflowStep>,
    @Inject(USER_SERVICE_CLIENT)
    private userClient: ClientProxy,
  ) {}

  /** Mirrors the same hook in WorkflowRuntimeService — called when a non-approval step is the last one */
  private async registerApprovedStudent(
    businessReference: string,
    tenantDomain: string,
  ): Promise<void> {
    const admissionNo = `ADM-${Date.now().toString().slice(-6)}`;
    try {
      const result = await firstValueFrom(
        this.userClient.send<{ id: number; admissionNo: string }>('students.create', {
          businessReference,
          tenantDomain,
          admissionNo,
        }),
      );
      console.log(
        `Student registered: admissionNo=${result.admissionNo} id=${result.id} ref=${businessReference}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to register student for ref=${businessReference}: ${(err as any)?.message ?? err}`,
      );
    }
  }

  /** Best-effort auto-assign — mirrors the same helper in WorkflowRuntimeService */
  private async tryAutoAssign(
    step: WorkflowStep,
    tenantDomain: string,
    actorUserId: number,
  ): Promise<{
    assignedToUserId: number | null;
    assignedByUserId: number | null;
    assignedAt: Date | null;
  }> {
    if (!step.requiredRole) {
      return { assignedToUserId: null, assignedByUserId: null, assignedAt: null };
    }
    try {
      const users = await firstValueFrom(
        this.userClient.send<Array<{ id: number }>>('users.findByRole', {
          role: step.requiredRole,
          tenantDomain,
        }),
      );
      if (Array.isArray(users) && users.length > 0) {
        return {
          assignedToUserId: users[0].id,
          assignedByUserId: actorUserId,
          assignedAt: new Date(),
        };
      }
    } catch {
      this.logger.warn(
        `Auto-assign skipped for role '${step.requiredRole}': user-service unreachable`,
      );
    }
    return { assignedToUserId: null, assignedByUserId: null, assignedAt: null };
  }

  async assignTask(dto: AssignTaskDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const task = await this.taskRepo.findOne({
      where: { id: dto.taskId },
      relations: ['instance'],
    });

    if (!task || task.instance.tenantDomain !== tenantDomain) {
      throw new RpcException({
        statusCode: 404,
        message: 'Task not found',
        error: 'Not Found',
      });
    }

    if (task.status !== TaskStatus.PENDING) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task already completed',
        error: 'Conflict',
      });
    }

    task.assignedToUserId = dto.assignToUserId;
    task.assignedByUserId = dto.assignedByUserId;
    task.assignedAt = new Date();
    await this.taskRepo.save(task);

    return { message: 'Task assigned', taskId: task.id };
  }

  async claimTask(dto: ClaimTaskDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const task = await this.taskRepo.findOne({
      where: { id: dto.taskId },
      relations: ['instance', 'step'],
    });

    if (!task || task.instance.tenantDomain !== tenantDomain) {
      throw new RpcException({
        statusCode: 404,
        message: 'Task not found',
        error: 'Not Found',
      });
    }

    if (task.status !== TaskStatus.PENDING) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task already completed',
        error: 'Conflict',
      });
    }

    assertCallerRole(task.step.requiredRole, dto.callerRole);

    if (
      task.assignedToUserId !== null &&
      task.assignedToUserId !== dto.claimantUserId
    ) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task is already assigned to another user',
        error: 'Conflict',
      });
    }

    task.assignedToUserId = dto.claimantUserId;
    task.assignedByUserId = task.assignedByUserId ?? dto.claimantUserId;
    task.assignedAt = new Date();
    await this.taskRepo.save(task);

    return { message: 'Task claimed', taskId: task.id };
  }

  async completeNonApprovalTask(dto: CompleteNonApprovalTaskDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const task = await this.taskRepo.findOne({
      where: { id: dto.taskId },
      relations: ['instance', 'step'],
    });

    if (!task || task.instance.tenantDomain !== tenantDomain) {
      throw new RpcException({
        statusCode: 404,
        message: 'Task not found',
        error: 'Not Found',
      });
    }

    const instance = task.instance;

    if (task.step.stepOrder !== instance.currentStepOrder) {
      throw new RpcException({
        statusCode: 409,
        message: 'Cannot complete task out of sequence',
        error: 'Conflict',
      });
    }

    // Accept PENDING or IN_PROGRESS (IN_PROGRESS = interview link dispatched, awaiting outcome)
    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.IN_PROGRESS) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task already completed',
        error: 'Conflict',
      });
    }

    assertCallerRole(task.step.requiredRole, dto.callerRole);

    if (dto.requiredStepType && task.step.stepType !== dto.requiredStepType) {
      throw new RpcException({
        statusCode: 409,
        message: `This endpoint is only for ${dto.requiredStepType} tasks`,
        error: 'Conflict',
      });
    }

    if (task.step.stepType === StepType.APPROVAL) {
      throw new RpcException({
        statusCode: 409,
        message: 'Use approvals endpoint for approval tasks',
        error: 'Conflict',
      });
    }

    if (
      task.assignedToUserId !== null &&
      task.assignedToUserId !== dto.actorUserId
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'Task is assigned to another user',
        error: 'Forbidden',
      });
    }

    const newStatus = dto.result === 'DONE' ? TaskStatus.APPROVED : TaskStatus.REJECTED;
    console.log(`Completing task ${task.id} with result ${dto.result} → status ${newStatus}`);
    task.status = newStatus;
    task.actedByUserId = dto.actorUserId;
    task.actedAt = new Date();
    task.comments = dto.comment ?? null;
    task.payloadJson =
      dto.payload !== undefined ? JSON.stringify(dto.payload) : null;
    await this.taskRepo.save(task);

    let nextTasks: WorkflowTask[] = [];

    if (dto.result === 'FAILED') {
      instance.status = WorkflowStatus.REJECTED;
      instance.completedAt = new Date();
      await this.instanceRepo.save(instance);
    } else {
      const nextStep = await this.stepRepo.findOne({
        where: {
          templateId: instance.templateId,
          stepOrder: MoreThan(instance.currentStepOrder),
        },
        order: { stepOrder: 'ASC' },
      });

      if (nextStep) {
        instance.currentStepOrder = nextStep.stepOrder;
        instance.status = WorkflowStatus.UNDER_REVIEW;
        await this.instanceRepo.save(instance);

        const assignment = await this.tryAutoAssign(nextStep, tenantDomain, dto.actorUserId);

        const nextTask = await this.taskRepo.save(
          this.taskRepo.create({
            instanceId: instance.id,
            stepId: nextStep.id,
            ...assignment,
            taskType: null,
            status: TaskStatus.PENDING,
            comments: null,
            actedByUserId: null,
            actedAt: null,
            payloadJson: null,
          }),
        );
        nextTasks = [nextTask];
      } else {
        instance.status = WorkflowStatus.APPROVED;
        instance.completedAt = new Date();
        await this.instanceRepo.save(instance);

        this.logger.log(
          `[WorkflowApproved] businessReference=${instance.businessReference} ` +
          `tenantDomain=${instance.tenantDomain} — triggering student registration`,
        );
        await this.registerApprovedStudent(instance.businessReference, instance.tenantDomain);
      }
    }

    return {
      message: dto.result === 'DONE' ? 'Task completed' : 'Task failed',
      instanceStatus: instance.status,
      nextTasks: nextTasks.length > 0 ? nextTasks : undefined,
    };
  }

  async skipOptionalTask(dto: SkipTaskDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const task = await this.taskRepo.findOne({
      where: { id: dto.taskId },
      relations: ['instance', 'step'],
    });

    if (!task || task.instance.tenantDomain !== tenantDomain) {
      throw new RpcException({
        statusCode: 404,
        message: 'Task not found',
        error: 'Not Found',
      });
    }

    if (!task.step.isOptional) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task step is not optional and cannot be skipped',
        error: 'Conflict',
      });
    }

    if (task.status !== TaskStatus.PENDING) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task already completed',
        error: 'Conflict',
      });
    }

    const instance = task.instance;

    if (task.step.stepOrder !== instance.currentStepOrder) {
      throw new RpcException({
        statusCode: 409,
        message: 'Cannot skip task out of sequence',
        error: 'Conflict',
      });
    }

    assertCallerRole(task.step.requiredRole, dto.callerRole);

    task.status = TaskStatus.APPROVED;
    task.actedByUserId = dto.actorUserId;
    task.actedAt = new Date();
    task.comments = 'Skipped';
    await this.taskRepo.save(task);

    let nextTasks: WorkflowTask[] = [];

    const nextStep = await this.stepRepo.findOne({
      where: {
        templateId: instance.templateId,
        stepOrder: MoreThan(instance.currentStepOrder),
      },
      order: { stepOrder: 'ASC' },
    });

    if (nextStep) {
      instance.currentStepOrder = nextStep.stepOrder;
      instance.status = WorkflowStatus.UNDER_REVIEW;
      await this.instanceRepo.save(instance);

      const assignment = await this.tryAutoAssign(nextStep, tenantDomain, dto.actorUserId);

      const nextTask = await this.taskRepo.save(
        this.taskRepo.create({
          instanceId: instance.id,
          stepId: nextStep.id,
          ...assignment,
          taskType: null,
          status: TaskStatus.PENDING,
          comments: null,
          actedByUserId: null,
          actedAt: null,
          payloadJson: null,
        }),
      );
      nextTasks = [nextTask];
    } else {
      instance.status = WorkflowStatus.APPROVED;
      instance.completedAt = new Date();
      await this.instanceRepo.save(instance);

      this.logger.log(
        `[WorkflowApproved] businessReference=${instance.businessReference} ` +
        `tenantDomain=${instance.tenantDomain} — triggering student registration`,
      );
      await this.registerApprovedStudent(instance.businessReference, instance.tenantDomain);
    }

    return {
      message: 'Task skipped',
      instanceStatus: instance.status,
      nextTasks: nextTasks.length > 0 ? nextTasks : undefined,
    };
  }

  async updateInterviewLink(dto: UpdateTaskPayloadDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const task = await this.taskRepo.findOne({
      where: { id: dto.taskId },
      relations: ['instance', 'step'],
    });

    if (!task || task.instance.tenantDomain !== tenantDomain) {
      throw new RpcException({
        statusCode: 404,
        message: 'Task not found',
        error: 'Not Found',
      });
    }

    if (task.step.stepType !== StepType.INTERVIEW) {
      throw new RpcException({
        statusCode: 409,
        message: 'This endpoint is only for INTERVIEW tasks',
        error: 'Conflict',
      });
    }

    if (task.status === TaskStatus.APPROVED || task.status === TaskStatus.REJECTED) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task already completed',
        error: 'Conflict',
      });
    }

    assertCallerRole(task.step.requiredRole, dto.callerRole);

    if (task.status === TaskStatus.PENDING) {
      task.status = TaskStatus.IN_PROGRESS;
    }

    task.comments = dto.comment ?? task.comments;
    task.payloadJson = dto.payload !== undefined ? JSON.stringify(dto.payload) : task.payloadJson;
    task.actedByUserId = dto.actorUserId;
    task.actedAt = new Date();
    await this.taskRepo.save(task);

    return {
      message: 'Interview link saved',
      taskId: task.id,
      taskStatus: task.status,
    };
  }

  /**
   * Hard-reject any task (any step type) with a required reason.
   * Sets task → REJECTED, instance → REJECTED, and bulk-cancels all
   * remaining PENDING/IN_PROGRESS tasks on the instance.
   */
  async rejectTask(dto: RejectTaskDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const task = await this.taskRepo.findOne({
      where: { id: dto.taskId },
      relations: ['instance', 'step'],
    });

    if (!task || task.instance.tenantDomain !== tenantDomain) {
      throw new RpcException({
        statusCode: 404,
        message: 'Task not found',
        error: 'Not Found',
      });
    }

    const instance = task.instance;

    if (TERMINAL_STATUSES.includes(instance.status)) {
      throw new RpcException({
        statusCode: 409,
        message: `Workflow is already in terminal status: ${instance.status}`,
        error: 'Conflict',
      });
    }

    if (task.step.stepOrder !== instance.currentStepOrder) {
      throw new RpcException({
        statusCode: 409,
        message: 'Cannot reject task out of sequence',
        error: 'Conflict',
      });
    }

    // Accept PENDING or IN_PROGRESS (e.g. interview was triggered but outcome is reject)
    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.IN_PROGRESS) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task already completed',
        error: 'Conflict',
      });
    }

    assertCallerRole(task.step.requiredRole, dto.callerRole);

    task.status = TaskStatus.REJECTED;
    task.comments = dto.reason;
    task.actedByUserId = dto.actorUserId;
    task.actedAt = new Date();
    await this.taskRepo.save(task);

    // Bulk-cancel any other PENDING/IN_PROGRESS tasks on this instance (safety net)
    const remaining = await this.taskRepo.find({
      where: { instanceId: instance.id, status: In([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]) },
    });
    const toCancel = remaining.filter((t) => t.id !== task.id);
    if (toCancel.length > 0) {
      for (const t of toCancel) {
        t.status = TaskStatus.REJECTED;
        t.actedByUserId = dto.actorUserId;
        t.actedAt = new Date();
        t.comments = `Rejected (cascade from task ${task.id}): ${dto.reason}`;
      }
      await this.taskRepo.save(toCancel);
    }

    instance.status = WorkflowStatus.REJECTED;
    instance.completedAt = new Date();
    await this.instanceRepo.save(instance);

    return {
      message: 'Task rejected',
      instanceStatus: instance.status,
      rejectedTaskId: task.id,
      cascadedRejections: toCancel.length,
    };
  }
}
