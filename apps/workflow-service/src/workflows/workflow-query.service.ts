import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { WorkflowTask } from './entities/workflow-task.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { TaskStatus } from './enums';
import { ListPendingTasksDto } from './dto/list-pending-tasks.dto';
import { GetInstanceDto } from './dto/get-instance.dto';

@Injectable()
export class WorkflowQueryService {
  constructor(
    @InjectRepository(WorkflowTask)
    private taskRepo: Repository<WorkflowTask>,
    @InjectRepository(WorkflowInstance)
    private instanceRepo: Repository<WorkflowInstance>,
  ) {}

  async listPendingTasks(dto: ListPendingTasksDto): Promise<WorkflowTask[]> {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const qb = this.taskRepo
      .createQueryBuilder('task')
      .innerJoinAndSelect('task.instance', 'instance')
      .innerJoinAndSelect('task.step', 'step')
      .innerJoinAndSelect('instance.template', 'template')
      .where('task.status = :status', { status: TaskStatus.PENDING })
      .andWhere('instance.tenantDomain = :tenantDomain', { tenantDomain });

    if (dto.schoolId !== undefined) {
      qb.andWhere('instance.schoolId = :schoolId', { schoolId: dto.schoolId });
    }

    // assignedToUserId takes priority over requiredRole for task filtering
    if (dto.assignedToUserId !== undefined) {
      qb.andWhere('task.assignedToUserId = :assignedToUserId', {
        assignedToUserId: dto.assignedToUserId,
      });
    } else if (dto.requiredRole) {
      qb.andWhere('step.requiredRole = :requiredRole', {
        requiredRole: dto.requiredRole,
      });
    }

    if (dto.templateCode) {
      qb.andWhere('template.templateCode = :templateCode', {
        templateCode: dto.templateCode,
      });
    }

    if (dto.module) {
      qb.andWhere('template.module = :module', { module: dto.module });
    }

    if (dto.instanceId !== undefined) {
      qb.andWhere('task.instanceId = :instanceId', { instanceId: dto.instanceId });
    }

    if (dto.businessReference) {
      qb.andWhere('instance.businessReference = :businessReference', {
        businessReference: dto.businessReference,
      });
    }

    return qb.orderBy('task.createdAt', 'DESC').getMany();
  }

  async getInstanceByReference(dto: GetInstanceDto): Promise<WorkflowInstance> {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const qb = this.instanceRepo
      .createQueryBuilder('instance')
      .innerJoinAndSelect('instance.template', 'template')
      .leftJoinAndSelect('template.steps', 'templateStep')
      .leftJoinAndSelect('instance.tasks', 'task')
      .leftJoinAndSelect('task.step', 'taskStep')
      .where('instance.tenantDomain = :tenantDomain', { tenantDomain })
      .andWhere('instance.businessReference = :businessReference', {
        businessReference: dto.businessReference,
      });

    if (dto.templateCode) {
      qb.andWhere('template.templateCode = :templateCode', {
        templateCode: dto.templateCode,
      });
    }

    const instance = await qb
      .orderBy('instance.createdAt', 'DESC')
      .addOrderBy('templateStep.stepOrder', 'ASC')
      .addOrderBy('task.createdAt', 'ASC')
      .getOne();

    if (!instance) {
      throw new RpcException({
        statusCode: 404,
        message: 'Workflow instance not found',
        error: 'Not Found',
      });
    }

    return instance;
  }
}
