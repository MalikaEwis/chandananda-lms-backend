import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { MoreThan, Repository } from 'typeorm';
import { WorkflowTask } from './entities/workflow-task.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { TaskStatus, WorkflowStatus, StepType } from './enums';

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

import { AssignTaskDto } from './dto/assign-task.dto';
import { ClaimTaskDto } from './dto/claim-task.dto';
import { CompleteNonApprovalTaskDto } from './dto/complete-non-approval-task.dto';
import { SkipTaskDto } from './dto/skip-task.dto';

@Injectable()
export class WorkflowTaskService {
  constructor(
    @InjectRepository(WorkflowTask)
    private taskRepo: Repository<WorkflowTask>,
    @InjectRepository(WorkflowInstance)
    private instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowStep)
    private stepRepo: Repository<WorkflowStep>,
  ) {}

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

    // Enforce required role before allowing claim
    assertCallerRole(task.step.requiredRole, dto.callerRole);

    // Prevent claim if already assigned to someone else
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

    // Enforce sequential rule
    if (task.step.stepOrder !== instance.currentStepOrder) {
      throw new RpcException({
        statusCode: 409,
        message: 'Cannot complete task out of sequence',
        error: 'Conflict',
      });
    }

    // Must be PENDING
    if (task.status !== TaskStatus.PENDING) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task already completed',
        error: 'Conflict',
      });
    }

    // Enforce required role
    assertCallerRole(task.step.requiredRole, dto.callerRole);

    // This endpoint is for non-approval steps only
    if (task.step.stepType === StepType.APPROVAL) {
      throw new RpcException({
        statusCode: 409,
        message: 'Use approvals endpoint for approval tasks',
        error: 'Conflict',
      });
    }

    // Enforce assignment — if task is assigned to someone else, deny
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

    // Record the outcome on the task
    task.status =
      dto.result === 'DONE' ? TaskStatus.APPROVED : TaskStatus.REJECTED;
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
      // Advance workflow: same logic as approval flow
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

        const nextTask = await this.taskRepo.save(
          this.taskRepo.create({
            instanceId: instance.id,
            stepId: nextStep.id,
            assignedToUserId: null,
            assignedByUserId: null,
            assignedAt: null,
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

    // Enforce required role before allowing skip
    assertCallerRole(task.step.requiredRole, dto.callerRole);

    // Mark the task as skipped (treated as APPROVED)
    task.status = TaskStatus.APPROVED;
    task.actedByUserId = dto.actorUserId;
    task.actedAt = new Date();
    task.comments = 'Skipped';
    await this.taskRepo.save(task);

    let nextTasks: WorkflowTask[] = [];

    // Advance workflow to the next step
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

      const nextTask = await this.taskRepo.save(
        this.taskRepo.create({
          instanceId: instance.id,
          stepId: nextStep.id,
          assignedToUserId: null,
          assignedByUserId: null,
          assignedAt: null,
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
    }

    return {
      message: 'Task skipped',
      instanceStatus: instance.status,
      nextTasks: nextTasks.length > 0 ? nextTasks : undefined,
    };
  }
}
