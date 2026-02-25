import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
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
  constructor(
    @InjectRepository(WorkflowTemplate)
    private templateRepo: Repository<WorkflowTemplate>,
    @InjectRepository(WorkflowStep)
    private stepRepo: Repository<WorkflowStep>,
    @InjectRepository(WorkflowInstance)
    private instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowTask)
    private taskRepo: Repository<WorkflowTask>,
  ) {}

  async startInstance(dto: StartWorkflowDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    // Validate template exists in tenant
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

    // Prevent duplicate instances for same business reference while not in a terminal state
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

    // Load the first step (lowest stepOrder)
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

    // Create the workflow instance (DB unique index guards against race-condition duplicates)
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

    // Create the initial pending task for the first step
    const task = await this.taskRepo.save(
      this.taskRepo.create({
        instanceId: instance.id,
        stepId: firstStep.id,
        assignedToUserId: null,
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

    // Load task with instance and step relations
    const task = await this.taskRepo.findOne({
      where: { id: dto.taskId },
      relations: ['instance', 'step'],
    });

    // Verify task exists and belongs to the correct tenant
    if (!task || task.instance.tenantDomain !== tenantDomain) {
      throw new RpcException({
        statusCode: 404,
        message: 'Task not found',
        error: 'Not Found',
      });
    }

    // Enforce sequential order — only current step's tasks can be completed
    const instance = task.instance;
    if (task.step.stepOrder !== instance.currentStepOrder) {
      throw new RpcException({
        statusCode: 409,
        message: 'Cannot complete task out of sequence',
        error: 'Conflict',
      });
    }

    // Prevent re-completion of an already-decided task
    if (task.status !== TaskStatus.PENDING) {
      throw new RpcException({
        statusCode: 409,
        message: 'Task already completed',
        error: 'Conflict',
      });
    }

    // Enforce required role
    assertCallerRole(task.step.requiredRole, dto.callerRole);

    // Record the decision on the task
    task.status =
      dto.action === 'APPROVE' ? TaskStatus.APPROVED : TaskStatus.REJECTED;
    task.comments = dto.comment ?? null;
    task.actedByUserId = dto.actorUserId;
    task.actedAt = new Date();
    await this.taskRepo.save(task);

    let nextTasks: WorkflowTask[] = [];

    if (dto.action === 'REJECT') {
      // Rejection closes the workflow immediately
      instance.status = WorkflowStatus.REJECTED;
      instance.completedAt = new Date();
      await this.instanceRepo.save(instance);
    } else {
      // Find the very next step in sequence
      const nextStep = await this.stepRepo.findOne({
        where: {
          templateId: instance.templateId,
          stepOrder: MoreThan(instance.currentStepOrder),
        },
        order: { stepOrder: 'ASC' },
      });

      if (nextStep) {
        // Advance to the next step
        instance.currentStepOrder = nextStep.stepOrder;
        instance.status = WorkflowStatus.UNDER_REVIEW;
        await this.instanceRepo.save(instance);

        // Create the pending task for the next step
        const nextTask = await this.taskRepo.save(
          this.taskRepo.create({
            instanceId: instance.id,
            stepId: nextStep.id,
            assignedToUserId: null,
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

    // Cancel all PENDING tasks for this instance
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
