import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { In, Repository } from 'typeorm';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { WorkflowTask } from './entities/workflow-task.entity';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';
import { WorkflowType, StepType } from './enums';

// ─── Generic step-match helper ────────────────────────────────────────────────

type CanonicalStep = {
  readonly stepName: string;
  readonly stepOrder: number;
  readonly stepType: StepType;
  readonly requiredRole: string;
  readonly isOptional: boolean;
};

function stepsMatchCanonical(live: WorkflowStep[], canonical: ReadonlyArray<CanonicalStep>): boolean {
  if (live.length !== canonical.length) return false;
  return canonical.every((def, i) => {
    const row = live[i];
    return (
      row.stepName === def.stepName &&
      row.stepOrder === def.stepOrder &&
      row.stepType === def.stepType &&
      row.requiredRole === def.requiredRole &&
      row.isOptional === def.isOptional
    );
  });
}

// ─── STUDENT_ADMISSION_V1 — Chandananda SRS 4-step ───────────────────────────

const STUDENT_ADMISSION_STEPS = [
  {
    stepName: 'Initial Screening',
    stepOrder: 1,
    stepType: StepType.APPROVAL,
    requiredRole: 'ADMIN',
    isOptional: false,
    description: 'Admin performs initial screening of the application',
  },
  {
    stepName: 'Section Head Review',
    stepOrder: 2,
    stepType: StepType.APPROVAL,
    requiredRole: 'SECTION_HEAD',
    isOptional: false,
    description: 'Section head reviews the screened application',
  },
  {
    stepName: 'Interview Panel',
    stepOrder: 3,
    stepType: StepType.INTERVIEW,
    requiredRole: 'INTERVIEW_PANEL',
    isOptional: false,
    description: 'Interview panel conducts and records the interview',
  },
  {
    stepName: 'Principal Final Approval',
    stepOrder: 4,
    stepType: StepType.APPROVAL,
    requiredRole: 'PRINCIPAL',
    isOptional: false,
    description: 'Principal gives final approval for student admission',
  },
] as const;

// ─── TEACHER_RECRUITMENT_V1 — Archdiocese 9-step ─────────────────────────────

const TEACHER_RECRUITMENT_STEPS = [
  {
    stepName: 'School First Interview',
    stepOrder: 1,
    stepType: StepType.INTERVIEW,
    requiredRole: 'PRINCIPAL',
    isOptional: false,
    description: 'Principal conducts first school-level interview',
  },
  {
    stepName: 'Archdiocese Review',
    stepOrder: 2,
    stepType: StepType.APPROVAL,
    requiredRole: 'ARCHDIOCESE_ADMIN',
    isOptional: false,
    description: 'Archdiocese reviews and approves the candidate',
  },
  {
    stepName: 'Probation Letter',
    stepOrder: 3,
    stepType: StepType.NOTIFICATION,
    requiredRole: 'ARCHDIOCESE_ADMIN',
    isOptional: true,
    description: 'Issue probation appointment letter (optional)',
  },
  {
    stepName: 'Probation Evaluation 1',
    stepOrder: 4,
    stepType: StepType.EVALUATION,
    requiredRole: 'PRINCIPAL',
    isOptional: false,
    description: 'First probation period evaluation by principal',
  },
  {
    stepName: 'Probation Evaluation 2',
    stepOrder: 5,
    stepType: StepType.EVALUATION,
    requiredRole: 'PRINCIPAL',
    isOptional: false,
    description: 'Second probation period evaluation by principal',
  },
  {
    stepName: 'Probation Evaluation 3',
    stepOrder: 6,
    stepType: StepType.EVALUATION,
    requiredRole: 'PRINCIPAL',
    isOptional: false,
    description: 'Third probation period evaluation by principal',
  },
  {
    stepName: 'School Second Interview',
    stepOrder: 7,
    stepType: StepType.INTERVIEW,
    requiredRole: 'PRINCIPAL',
    isOptional: false,
    description: 'Principal conducts second school-level interview',
  },
  {
    stepName: 'Archdiocese Final Interview',
    stepOrder: 8,
    stepType: StepType.INTERVIEW,
    requiredRole: 'ARCHDIOCESE_ADMIN',
    isOptional: false,
    description: 'Archdiocese conducts final confirmation interview',
  },
  {
    stepName: 'Confirmation',
    stepOrder: 9,
    stepType: StepType.APPROVAL,
    requiredRole: 'ARCHDIOCESE_ADMIN',
    isOptional: false,
    description: 'Archdiocese issues final confirmation of appointment',
  },
] as const;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WorkflowTemplatesService {
  private readonly logger = new Logger(WorkflowTemplatesService.name);

  constructor(
    @InjectRepository(WorkflowTemplate)
    private templateRepo: Repository<WorkflowTemplate>,
    @InjectRepository(WorkflowStep)
    private stepRepo: Repository<WorkflowStep>,
    @InjectRepository(WorkflowTask)
    private taskRepo: Repository<WorkflowTask>,
  ) {}

  async create(dto: CreateWorkflowTemplateDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

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

    const orders = dto.steps.map((s) => s.stepOrder);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      throw new RpcException({
        statusCode: 409,
        message: 'Duplicate stepOrder values found in steps',
        error: 'Conflict',
      });
    }

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

  /**
   * Idempotent seed for STUDENT_ADMISSION_V1 (Chandananda SRS 4-step).
   * Safe to call multiple times.
   */
  async seedStudentAdmission(tenantDomain?: string) {
    return this.seedTemplate({
      templateCode: 'STUDENT_ADMISSION_V1',
      name: 'Student Admission',
      workflowType: WorkflowType.STUDENT_ADMISSION,
      description:
        'Chandananda SRS — 4-level student admission workflow: ' +
        'Initial Screening → Section Head Review → Interview Panel → Principal Final Approval',
      steps: STUDENT_ADMISSION_STEPS,
      tenantDomain,
    });
  }

  /**
   * Idempotent seed for TEACHER_REGISTRATION_CHANDANANDA (3-step SRS online submission).
   * Safe to call multiple times.
   */
  async seedChandanandaTeacher(tenantDomain?: string) {
    return this.seedTemplate({
      templateCode: 'TEACHER_REGISTRATION_CHANDANANDA',
      name: 'Teacher Registration (Chandananda)',
      workflowType: WorkflowType.TEACHER_RECRUITMENT,
      description:
        'Chandananda SRS — 3-step teacher registration: ' +
        'Application Submission → Panel Qualification Review → Final Decision',
      steps: [
        {
          stepName: 'Application Submission',
          stepOrder: 1,
          stepType: StepType.REVIEW,
          requiredRole: 'ADMIN',
          isOptional: true,
          description: 'Initial application review and completeness check',
        },
        {
          stepName: 'Panel Qualification Review',
          stepOrder: 2,
          stepType: StepType.APPROVAL,
          requiredRole: 'PANEL_MEMBER',
          isOptional: false,
          description: 'Panel reviews candidate qualifications and approves for final decision',
        },
        {
          stepName: 'Final Decision',
          stepOrder: 3,
          stepType: StepType.APPROVAL,
          requiredRole: 'PRINCIPAL',
          isOptional: false,
          description: 'Principal makes final appointment decision',
        },
      ],
      tenantDomain,
    });
  }

  /**
   * Idempotent seed for TEACHER_RECRUITMENT_V1 (Archdiocese 9-step).
   * Safe to call multiple times.
   */
  async seedTeacherRecruitment(tenantDomain?: string) {
    return this.seedTemplate({
      templateCode: 'TEACHER_RECRUITMENT_V1',
      name: 'Teacher Recruitment',
      workflowType: WorkflowType.TEACHER_RECRUITMENT,
      description:
        'Archdiocese teacher recruitment — 9-step workflow: ' +
        'School Interview → Archdiocese Review → Probation (×3 evaluations) → ' +
        'Second Interview → Final Interview → Confirmation',
      steps: TEACHER_RECRUITMENT_STEPS,
      tenantDomain,
    });
  }

  /**
   * Shared idempotent seed logic.
   * Three outcomes: created (first run) | no-op (already correct) | rebuilt (steps differ).
   */
  private async seedTemplate(opts: {
    templateCode: string;
    name: string;
    workflowType: WorkflowType;
    description: string;
    steps: ReadonlyArray<CanonicalStep & { description: string }>;
    tenantDomain?: string;
  }) {
    const normalizedTenant = opts.tenantDomain
      ? opts.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    let template = await this.templateRepo.findOne({
      where: { templateCode: opts.templateCode, tenantDomain: normalizedTenant },
    });

    // ── First run ──────────────────────────────────────────────────────────────
    if (!template) {
      template = await this.templateRepo.save(
        this.templateRepo.create({
          name: opts.name,
          templateCode: opts.templateCode,
          workflowType: opts.workflowType,
          tenantDomain: normalizedTenant,
          description: opts.description,
          isActive: true,
        }),
      );

      const steps = await this.stepRepo.save(
        opts.steps.map((s) => this.stepRepo.create({ ...s, templateId: template!.id })),
      );

      return {
        message: `${opts.templateCode} created for tenant '${normalizedTenant}'`,
        action: 'created',
        template: { ...template, steps },
      };
    }

    // ── Already correct ────────────────────────────────────────────────────────
    const currentSteps = await this.stepRepo.find({
      where: { templateId: template.id },
      order: { stepOrder: 'ASC' },
    });

    if (stepsMatchCanonical(currentSteps, opts.steps)) {
      return {
        message: `${opts.templateCode} already correct for tenant '${normalizedTenant}'`,
        action: 'no-op',
        template: { ...template, steps: currentSteps },
      };
    }

    // ── Rebuild: delete tasks → steps → recreate ───────────────────────────────
    this.logger.warn(
      `${opts.templateCode} steps mismatch for tenant '${normalizedTenant}' — rebuilding`,
    );

    const currentStepIds = currentSteps.map((s) => s.id);
    if (currentStepIds.length > 0) {
      const deletedTasks = await this.taskRepo.delete({ stepId: In(currentStepIds) });
      if ((deletedTasks.affected ?? 0) > 0) {
        this.logger.warn(
          `Deleted ${deletedTasks.affected} task(s) referencing old steps of ${opts.templateCode}`,
        );
      }
    }

    await this.stepRepo.delete({ templateId: template.id });

    template.name = opts.name;
    template.workflowType = opts.workflowType;
    template.isActive = true;
    await this.templateRepo.save(template);

    const steps = await this.stepRepo.save(
      opts.steps.map((s) => this.stepRepo.create({ ...s, templateId: template!.id })),
    );

    return {
      message: `${opts.templateCode} rebuilt for tenant '${normalizedTenant}'`,
      action: 'rebuilt',
      template: { ...template, steps },
    };
  }
}
