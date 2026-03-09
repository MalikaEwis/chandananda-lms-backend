import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowRuntimeService } from './workflow-runtime.service';
import { WorkflowQueryService } from './workflow-query.service';
import { WorkflowTaskService } from './workflow-task.service';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { ListPendingTasksDto } from './dto/list-pending-tasks.dto';
import { GetInstanceDto } from './dto/get-instance.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { ClaimTaskDto } from './dto/claim-task.dto';
import { CompleteNonApprovalTaskDto } from './dto/complete-non-approval-task.dto';
import { SkipTaskDto } from './dto/skip-task.dto';
import { UpdateTaskPayloadDto } from './dto/update-task-payload.dto';
import { CancelWorkflowDto } from './dto/cancel-workflow.dto';
import { MarkRegisteredDto } from './dto/mark-registered.dto';
import { RejectTaskDto } from './dto/reject-task.dto';

@Controller()
export class WorkflowsController {
  constructor(
    private readonly templates: WorkflowTemplatesService,
    private readonly runtime: WorkflowRuntimeService,
    private readonly query: WorkflowQueryService,
    private readonly tasks: WorkflowTaskService,
  ) {}

  // ─── Templates ────────────────────────────────────────────────────────────

  @MessagePattern('workflows.template.create')
  create(@Payload() dto: CreateWorkflowTemplateDto) {
    return this.templates.create(dto);
  }

  @MessagePattern('workflows.template.getByCode')
  getByCode(
    @Payload() payload: { templateCode: string; tenantDomain?: string },
  ) {
    return this.templates.getByCode(payload.templateCode, payload.tenantDomain);
  }

  /** Idempotent seed for the canonical STUDENT_ADMISSION_V1 (SRS 4-step) */
  @MessagePattern('workflows.seed.studentAdmission')
  seedStudentAdmission(@Payload() payload: { tenantDomain?: string }) {
    return this.templates.seedStudentAdmission(payload.tenantDomain);
  }

  /** Idempotent seed for TEACHER_RECRUITMENT_V1 (Archdiocese 9-step) */
  @MessagePattern('workflows.seed.teacherRecruitment')
  seedTeacherRecruitment(@Payload() payload: { tenantDomain?: string }) {
    return this.templates.seedTeacherRecruitment(payload.tenantDomain);
  }

  // ─── Instances ────────────────────────────────────────────────────────────

  @MessagePattern('workflows.instance.start')
  startInstance(@Payload() dto: StartWorkflowDto) {
    return this.runtime.startInstance(dto);
  }

  @MessagePattern('workflows.instance.cancel')
  cancelInstance(@Payload() dto: CancelWorkflowDto) {
    return this.runtime.cancelInstance(dto);
  }

  @MessagePattern('workflows.instance.markRegistered')
  markRegistered(@Payload() dto: MarkRegisteredDto) {
    return this.runtime.markRegistered(dto);
  }

  @MessagePattern('workflows.instance.getByReference')
  getInstanceByReference(@Payload() dto: GetInstanceDto) {
    return this.query.getInstanceByReference(dto);
  }

  // ─── Task queries ─────────────────────────────────────────────────────────

  @MessagePattern('workflows.tasks.pending')
  listPendingTasks(@Payload() dto: ListPendingTasksDto) {
    return this.query.listPendingTasks(dto);
  }

  // ─── Task actions ─────────────────────────────────────────────────────────

  @MessagePattern('workflows.task.complete')
  completeTask(@Payload() dto: CompleteTaskDto) {
    return this.runtime.completeTask(dto);
  }

  @MessagePattern('workflows.task.reject')
  rejectTask(@Payload() dto: RejectTaskDto) {
    return this.tasks.rejectTask(dto);
  }

  @MessagePattern('workflows.task.assign')
  assignTask(@Payload() dto: AssignTaskDto) {
    return this.tasks.assignTask(dto);
  }

  @MessagePattern('workflows.task.claim')
  claimTask(@Payload() dto: ClaimTaskDto) {
    return this.tasks.claimTask(dto);
  }

  @MessagePattern('workflows.task.completeNonApproval')
  completeNonApprovalTask(@Payload() dto: CompleteNonApprovalTaskDto) {
    return this.tasks.completeNonApprovalTask(dto);
  }

  @MessagePattern('workflows.task.skipOptional')
  skipOptionalTask(@Payload() dto: SkipTaskDto) {
    return this.tasks.skipOptionalTask(dto);
  }

  @MessagePattern('workflows.task.updateInterviewLink')
  updateInterviewLink(@Payload() dto: UpdateTaskPayloadDto) {
    return this.tasks.updateInterviewLink(dto);
  }
}
