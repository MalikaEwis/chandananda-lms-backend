import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';

@Injectable()
export class WorkflowTemplatesService {
  constructor(
    @InjectRepository(WorkflowTemplate)
    private templateRepo: Repository<WorkflowTemplate>,
    @InjectRepository(WorkflowStep)
    private stepRepo: Repository<WorkflowStep>,
  ) {}

  async create(dto: CreateWorkflowTemplateDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    // Enforce uniqueness: templateCode + tenantDomain
    const existing = await this.templateRepo.findOne({
      where: { templateCode: dto.templateCode, tenantDomain },
    });
    if (existing) {
      throw new RpcException({
        statusCode: 409,
        message: `Template code '${dto.templateCode}' already exists in this tenant`,
        error: 'Conflict',
      });
    }

    // Enforce unique stepOrder within the submitted steps list
    const orders = dto.steps.map((s) => s.stepOrder);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      throw new RpcException({
        statusCode: 409,
        message: 'Duplicate stepOrder values found in steps',
        error: 'Conflict',
      });
    }

    // Save the template
    const template = this.templateRepo.create({
      name: dto.name,
      templateCode: dto.templateCode,
      workflowType: dto.workflowType,
      tenantDomain,
      schoolId: dto.schoolId ?? null,
      module: dto.module ?? null,
      description: dto.description ?? null,
    });
    const savedTemplate = await this.templateRepo.save(template);

    // Save the steps
    const steps = dto.steps.map((s) =>
      this.stepRepo.create({
        templateId: savedTemplate.id,
        stepName: s.stepName,
        stepOrder: s.stepOrder,
        stepType: s.stepType,
        isOptional: s.isOptional ?? false,
        requiredRole: s.requiredRole ?? null,
        description: s.description ?? null,
      }),
    );
    const savedSteps = await this.stepRepo.save(steps);

    return { ...savedTemplate, steps: savedSteps };
  }

  async getByCode(templateCode: string, tenantDomain?: string) {
    const normalizedTenant = tenantDomain
      ? tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const template = await this.templateRepo.findOne({
      where: { templateCode, tenantDomain: normalizedTenant },
    });

    if (!template) {
      throw new RpcException({
        statusCode: 404,
        message: `Template '${templateCode}' not found in this tenant`,
        error: 'Not Found',
      });
    }

    const steps = await this.stepRepo.find({
      where: { templateId: template.id },
      order: { stepOrder: 'ASC' },
    });

    return { ...template, steps };
  }
}
