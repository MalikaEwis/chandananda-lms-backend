import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { of } from 'rxjs';
import { WorkflowTaskService } from './workflow-task.service';
import { WorkflowTask } from './entities/workflow-task.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { TaskStatus, WorkflowStatus, StepType } from './enums';
import { USER_SERVICE_CLIENT } from './constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    id: 10,
    templateId: 1,
    stepName: 'Initial Screening',
    stepOrder: 1,
    stepType: StepType.APPROVAL,
    isOptional: false,
    requiredRole: 'ADMIN',
    description: null,
    createdAt: new Date(),
    template: {} as any,
    ...overrides,
  } as WorkflowStep;
}

function makeInstance(overrides: Partial<WorkflowInstance> = {}): WorkflowInstance {
  return {
    id: 1,
    templateId: 1,
    businessReference: 'APP-001',
    tenantDomain: 'cc.lk',
    schoolId: null,
    status: WorkflowStatus.UNDER_REVIEW,
    currentStepOrder: 1,
    submittedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    tasks: [],
    template: {} as any,
    normalizeTenantDomain: jest.fn(),
    ...overrides,
  } as WorkflowInstance;
}

function makeTask(
  step: WorkflowStep,
  instance: WorkflowInstance,
  overrides: Partial<WorkflowTask> = {},
): WorkflowTask {
  return {
    id: 5,
    instanceId: instance.id,
    instance,
    stepId: step.id,
    step,
    assignedToUserId: null,
    assignedByUserId: null,
    assignedAt: null,
    taskType: null,
    status: TaskStatus.PENDING,
    comments: null,
    actedByUserId: null,
    actedAt: null,
    payloadJson: null,
    createdAt: new Date(),
    ...overrides,
  } as WorkflowTask;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('WorkflowTaskService', () => {
  let service: WorkflowTaskService;
  let taskRepo: jest.Mocked<any>;
  let instanceRepo: jest.Mocked<any>;
  let stepRepo: jest.Mocked<any>;
  let userClient: jest.Mocked<any>;

  beforeEach(async () => {
    taskRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
    };
    instanceRepo = {
      save: jest.fn(),
    };
    stepRepo = {
      findOne: jest.fn(),
    };
    userClient = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowTaskService,
        { provide: getRepositoryToken(WorkflowTask), useValue: taskRepo },
        { provide: getRepositoryToken(WorkflowInstance), useValue: instanceRepo },
        { provide: getRepositoryToken(WorkflowStep), useValue: stepRepo },
        { provide: USER_SERVICE_CLIENT, useValue: userClient },
      ],
    }).compile();

    service = module.get(WorkflowTaskService);
  });

  // ─── rejectTask ────────────────────────────────────────────────────────────

  describe('rejectTask', () => {
    it('marks task REJECTED, sets instance REJECTED with completedAt, returns rejection summary', async () => {
      const step = makeStep();
      const instance = makeInstance();
      const task = makeTask(step, instance);

      taskRepo.findOne.mockResolvedValueOnce(task);
      taskRepo.save.mockImplementation((entity) => Promise.resolve(entity));
      taskRepo.find.mockResolvedValueOnce([]); // no other pending tasks
      instanceRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.rejectTask({
        taskId: 5,
        actorUserId: 99,
        reason: 'Documents incomplete',
        tenantDomain: 'cc.lk',
        callerRole: 'ADMIN',
      });

      expect(task.status).toBe(TaskStatus.REJECTED);
      expect(task.comments).toBe('Documents incomplete');
      expect(task.actedByUserId).toBe(99);
      expect(instance.status).toBe(WorkflowStatus.REJECTED);
      expect(instance.completedAt).toBeInstanceOf(Date);
      expect(result.message).toBe('Task rejected');
      expect(result.instanceStatus).toBe(WorkflowStatus.REJECTED);
      expect(result.cascadedRejections).toBe(0);
    });

    it('bulk-cancels remaining PENDING tasks on cascade', async () => {
      const step = makeStep();
      const instance = makeInstance();
      const task = makeTask(step, instance);

      const otherTask = makeTask(makeStep({ id: 20, stepOrder: 2 }), instance, {
        id: 6,
        status: TaskStatus.PENDING,
      });

      taskRepo.findOne.mockResolvedValueOnce(task);
      taskRepo.save.mockImplementation((entity) => Promise.resolve(entity));
      // find returns the OTHER task as still pending (not the rejected one)
      taskRepo.find.mockResolvedValueOnce([otherTask]);
      instanceRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.rejectTask({
        taskId: 5,
        actorUserId: 99,
        reason: 'Application withdrawn',
        tenantDomain: 'cc.lk',
        callerRole: 'ADMIN',
      });

      expect(otherTask.status).toBe(TaskStatus.REJECTED);
      expect(otherTask.comments).toContain('cascade from task 5');
      expect(result.cascadedRejections).toBe(1);
    });

    it('throws 409 when workflow is already in terminal status', async () => {
      const step = makeStep();
      const instance = makeInstance({ status: WorkflowStatus.APPROVED });
      const task = makeTask(step, instance);

      taskRepo.findOne.mockResolvedValueOnce(task);

      await expect(
        service.rejectTask({
          taskId: 5,
          actorUserId: 99,
          reason: 'Test',
          tenantDomain: 'cc.lk',
        }),
      ).rejects.toBeInstanceOf(RpcException);
    });

    it('throws 404 when task not found', async () => {
      taskRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.rejectTask({
          taskId: 999,
          actorUserId: 1,
          reason: 'Test',
          tenantDomain: 'cc.lk',
        }),
      ).rejects.toBeInstanceOf(RpcException);
    });
  });

  // ─── Auto-assignment (via claimTask + tryAutoAssign indirectly) ────────────
  // We test the public surface: completeNonApprovalTask creates next task
  // with auto-assignment when user-service returns a user.

  describe('auto-assignment on completeNonApprovalTask', () => {
    it('auto-assigns next task when user-service returns a matching user', async () => {
      const currentStep = makeStep({
        stepOrder: 1,
        stepType: StepType.REVIEW,
        requiredRole: null,
      });
      const nextStep = makeStep({
        id: 20,
        stepOrder: 2,
        stepType: StepType.APPROVAL,
        requiredRole: 'SECTION_HEAD',
      });
      const instance = makeInstance({ currentStepOrder: 1 });
      const task = makeTask(currentStep, instance, { status: TaskStatus.PENDING });

      taskRepo.findOne.mockResolvedValueOnce(task);
      stepRepo.findOne.mockResolvedValueOnce(nextStep);

      // user-service returns a SECTION_HEAD user
      userClient.send.mockReturnValue(of([{ id: 42, role: 'SECTION_HEAD' }]));

      let savedNextTask: any = null;
      taskRepo.save.mockImplementation((entity) => {
        const saved = { ...entity, id: 99 };
        if (!entity.actedAt) savedNextTask = saved; // next task has no actedAt
        return Promise.resolve(saved);
      });
      taskRepo.create.mockImplementation((data) => ({ ...data }));
      instanceRepo.save.mockImplementation((e) => Promise.resolve(e));

      await service.completeNonApprovalTask({
        taskId: 5,
        actorUserId: 7,
        result: 'DONE',
        tenantDomain: 'cc.lk',
        callerRole: 'ADMIN',
      });

      expect(userClient.send).toHaveBeenCalledWith('users.findByRole', {
        role: 'SECTION_HEAD',
        tenantDomain: 'cc.lk',
      });
      expect(savedNextTask).not.toBeNull();
      expect(savedNextTask.assignedToUserId).toBe(42);
      expect(savedNextTask.assignedByUserId).toBe(7);
      expect(savedNextTask.assignedAt).toBeInstanceOf(Date);
    });

    it('leaves next task unassigned when user-service returns empty array', async () => {
      const currentStep = makeStep({ stepOrder: 1, stepType: StepType.REVIEW, requiredRole: null });
      const nextStep = makeStep({ id: 20, stepOrder: 2, requiredRole: 'SECTION_HEAD' });
      const instance = makeInstance({ currentStepOrder: 1 });
      const task = makeTask(currentStep, instance, { status: TaskStatus.PENDING });

      taskRepo.findOne.mockResolvedValueOnce(task);
      stepRepo.findOne.mockResolvedValueOnce(nextStep);

      userClient.send.mockReturnValue(of([])); // no users found

      let savedNextTask: any = null;
      taskRepo.save.mockImplementation((entity) => {
        const saved = { ...entity, id: 99 };
        if (!entity.actedAt) savedNextTask = saved;
        return Promise.resolve(saved);
      });
      taskRepo.create.mockImplementation((data) => ({ ...data }));
      instanceRepo.save.mockImplementation((e) => Promise.resolve(e));

      await service.completeNonApprovalTask({
        taskId: 5,
        actorUserId: 7,
        result: 'DONE',
        tenantDomain: 'cc.lk',
        callerRole: 'ADMIN',
      });

      expect(savedNextTask.assignedToUserId).toBeNull();
      expect(savedNextTask.assignedByUserId).toBeNull();
    });
  });
});
