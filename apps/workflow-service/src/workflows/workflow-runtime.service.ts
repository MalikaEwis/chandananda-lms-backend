import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { In, MoreThan, Not, QueryFailedError, Repository } from 'typeorm';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowTask } from './entities/workflow-task.entity';
import { WorkflowStatus, TaskStatus } from './enums';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { CancelWorkflowDto } from './dto/cancel-workflow.dto';
import { MarkRegisteredDto } from './dto/mark-registered.dto';
import { USER_SERVICE_CLIENT } from './constants';

// Terminal statuses — a new instance may only be started when the previous one reached one of these
const TERMINAL_STATUSES = [WorkflowStatus.APPROVED, WorkflowStatus.REJECTED, WorkflowStatus.CANCELLED];

// Roles that bypass per-step role restrictions
const SUPERUSER_ROLES = ['ADMIN', 'SUPER_ADMIN'];

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
export class WorkflowRuntimeService {
  private readonly logger = new Logger(WorkflowRuntimeService.name);

  constructor(
    @InjectRepository(WorkflowTemplate)
    private templateRepo: Repository<WorkflowTemplate>,
    @InjectRepository(WorkflowStep)
    private stepRepo: Repository<WorkflowStep>,
    @InjectRepository(WorkflowInstance)
    private instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowTask)
    private taskRepo: Repository<WorkflowTask>,
    @Inject(USER_SERVICE_CLIENT)
    private userClient: ClientProxy,
  ) {}

  /**
   * Fires after a STUDENT_ADMISSION workflow reaches terminal APPROVED status.
   * Non-blocking — errors are logged but never propagate to the caller.
   */
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
      console.log('Student registered:', result);
    } catch (err) {
      console.error(
        `Failed to register student for ${businessReference}`,
        (err as any)?.message ?? err,
      );
    }
  }

  /**
   * Fires after a TEACHER_RECRUITMENT workflow reaches terminal APPROVED status.
   * Generates a Archdiocese TIN and creates a Staff record in user-service via TCP.
   * Non-blocking — errors are logged but never propagate to the caller.
   */
  private async registerApprovedStaff(
    businessReference: string,
    tenantDomain: string,
  ): Promise<void> {
    const part1 = Math.floor(Math.random() * 9) + 1;
    const part2 = Math.floor(Math.random() * 999) + 1;
    const part3 = Math.floor(Math.random() * 999) + 1;
    const part4 = Math.floor(Math.random() * 9999) + 1;
    const tinNumber = `${part1}/${String(part2).padStart(3, '0')}/${String(part3).padStart(3, '0')}/${String(part4).padStart(4, '0')}`;

    this.logger.log(
      `[WorkflowApproved] businessReference=${businessReference} tenantDomain=${tenantDomain} ` +
      `— triggering staff registration, TIN=${tinNumber}`,
    );

    try {
      const result = await firstValueFrom(
        this.userClient.send<{ id: number; teacherIdentificationNumber: string }>(
          'staff.createFromRecruitment',
          { businessReference, tenantDomain, tinNumber, part1, part2, part3, part4 },
        ),
      );
      console.log('Staff registered:', { id: result.id, teacherIdentificationNumber: result.teacherIdentificationNumber });
    } catch (err) {
      console.error(
        `Failed to register staff for ${businessReference}`,
        (err as any)?.message ?? err,
      );
    }
  }

  /**
   * Best-effort auto-assign: queries user-service for the first ACTIVE user
   * matching the step's requiredRole. Returns null fields when none is found
   * or user-service is unreachable — ADMIN can assign manually in that case.
   */
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

  async startInstance(dto: StartWorkflowDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const template = await this.templateRepo.findOne({
      where: { templateCode: dto.templateCode, tenantDomain },
    });
    if (!template) {
      throw new RpcException({
        statusCode: 404,
        message: `Workflow template '${dto.templateCode}' not found in this tenant`,
        error: 'Not Found',
      });
    }

    const existing = await this.instanceRepo.findOne({
      where: {
        tenantDomain,
        templateId: template.id,
        businessReference: dto.businessReference,
        status: Not(In(TERMINAL_STATUSES)),
      },
    });
    if (existing) {
      throw new RpcException({
        statusCode: 409,
        message: 'Workflow instance already exists for this reference',
        error: 'Conflict',
      });
    }

    const firstStep = await this.stepRepo.findOne({
      where: { templateId: template.id },
      order: { stepOrder: 'ASC' },
    });
    if (!firstStep) {
      throw new RpcException({
        statusCode: 400,
        message: 'Workflow template has no steps defined',
        error: 'Bad Request',
      });
    }

    let instance!: WorkflowInstance;
    try {
      instance = await this.instanceRepo.save(
        this.instanceRepo.create({
          templateId: template.id,
          tenantDomain,
          schoolId: dto.schoolId ?? null,
          businessReference: dto.businessReference,
          currentStepOrder: firstStep.stepOrder,
          status: WorkflowStatus.SUBMITTED,
          submittedAt: new Date(),
        }),
      );
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).errno === 1062) {
        throw new RpcException({
          statusCode: 409,
          message: 'Workflow instance already exists for this reference',
          error: 'Conflict',
        });
      }
      throw err;
    }

    const assignment = await this.tryAutoAssign(firstStep, tenantDomain, dto.startedByUserId);

    const task = await this.taskRepo.save(
      this.taskRepo.create({
        instanceId: instance.id,
        stepId: firstStep.id,
        ...assignment,
        status: TaskStatus.PENDING,
        comments: null,
        actedByUserId: null,
        actedAt: null,
      }),
    );

    return { instance, tasks: [task] };
  }

  async completeTask(dto: CompleteTaskDto) {
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

    if (task.status !== TaskStatus.PENDING) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task already completed',
        error: 'Conflict',
      });
    }

    assertCallerRole(task.step.requiredRole, dto.callerRole);

    const newStatus = dto.action === 'APPROVE' ? TaskStatus.APPROVED : TaskStatus.REJECTED;
    console.log(`Completing task ${task.id} with action ${dto.action} → status ${newStatus}`);
    task.status = newStatus;
    task.comments = dto.comment ?? null;
    task.actedByUserId = dto.actorUserId;
    task.actedAt = new Date();
    await this.taskRepo.save(task);

    let nextTasks: WorkflowTask[] = [];

    if (dto.action === 'REJECT') {
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
            status: TaskStatus.PENDING,
            comments: null,
            actedByUserId: null,
            actedAt: null,
          }),
        );
        nextTasks = [nextTask];
      } else {
        // All steps approved — workflow complete
        instance.status = WorkflowStatus.APPROVED;
        instance.completedAt = new Date();
        await this.instanceRepo.save(instance);

        const template = await this.templateRepo.findOne({ where: { id: instance.templateId } });
        const templateCode = template?.templateCode ?? '';

        this.logger.log(
          `[WorkflowApproved] businessReference=${instance.businessReference} ` +
          `tenantDomain=${instance.tenantDomain} templateCode=${templateCode}`,
        );

        if (templateCode === 'TEACHER_RECRUITMENT_V1') {
          await this.registerApprovedStaff(instance.businessReference, instance.tenantDomain);
        } else {
          this.logger.log(`— triggering student registration`);
          await this.registerApprovedStudent(instance.businessReference, instance.tenantDomain);
        }
      }
    }

    return {
      message: dto.action === 'APPROVE' ? 'Task approved' : 'Task rejected',
      instanceStatus: instance.status,
      nextTasks: nextTasks.length > 0 ? nextTasks : undefined,
    };
  }

  async cancelInstance(dto: CancelWorkflowDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const template = await this.templateRepo.findOne({
      where: { templateCode: dto.templateCode, tenantDomain },
    });
    if (!template) {
      throw new RpcException({
        statusCode: 404,
        message: `Workflow template '${dto.templateCode}' not found in this tenant`,
        error: 'Not Found',
      });
    }

    const instance = await this.instanceRepo.findOne({
      where: { tenantDomain, templateId: template.id, businessReference: dto.businessReference },
    });
    if (!instance) {
      throw new RpcException({
        statusCode: 404,
        message: 'Workflow instance not found',
        error: 'Not Found',
      });
    }

    if (TERMINAL_STATUSES.includes(instance.status)) {
      throw new RpcException({
        statusCode: 409,
        message: `Cannot cancel a workflow instance in terminal status: ${instance.status}`,
        error: 'Conflict',
      });
    }

    const pendingTasks = await this.taskRepo.find({
      where: { instanceId: instance.id, status: TaskStatus.PENDING },
    });
    const cancelComment = dto.reason ? `Cancelled: ${dto.reason}` : 'Cancelled';
    for (const t of pendingTasks) {
      t.status = TaskStatus.REJECTED;
      t.actedByUserId = dto.actorUserId;
      t.actedAt = new Date();
      t.comments = cancelComment;
    }
    if (pendingTasks.length > 0) {
      await this.taskRepo.save(pendingTasks);
    }

    instance.status = WorkflowStatus.CANCELLED;
    instance.completedAt = new Date();
    await this.instanceRepo.save(instance);

    return {
      message: 'Workflow instance cancelled',
      instanceId: instance.id,
      cancelledTasks: pendingTasks.length,
    };
  }

  async markRegistered(dto: MarkRegisteredDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const template = await this.templateRepo.findOne({
      where: { templateCode: dto.templateCode, tenantDomain },
    });
    if (!template) {
      throw new RpcException({
        statusCode: 404,
        message: `Workflow template '${dto.templateCode}' not found in this tenant`,
        error: 'Not Found',
      });
    }

    const instance = await this.instanceRepo.findOne({
      where: { tenantDomain, templateId: template.id, businessReference: dto.businessReference },
    });
    if (!instance) {
      throw new RpcException({
        statusCode: 404,
        message: 'Workflow instance not found',
        error: 'Not Found',
      });
    }

    if (instance.status !== WorkflowStatus.APPROVED) {
      throw new RpcException({
        statusCode: 409,
        message: `Only APPROVED instances can be marked as REGISTERED. Current status: ${instance.status}`,
        error: 'Conflict',
      });
    }

    instance.status = WorkflowStatus.REGISTERED;
    await this.instanceRepo.save(instance);

    return {
      message: 'Workflow instance marked as REGISTERED',
      instanceId: instance.id,
    };
  }
}
