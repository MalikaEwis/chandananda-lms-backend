import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { Request } from 'express';
import { MICROSERVICES_CLIENTS } from '../constants';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Shared error extractor — resolves the first candidate that carries a numeric statusCode.
// NestJS TCP delivers RpcException payloads at different nesting depths depending on
// how the microservice threw (flat, single-wrapped, or double-wrapped).
function rpcError(err: any) {
  const candidates = [err?.error?.error, err?.error, err];
  const payload =
    candidates.find((c) => c != null && typeof c === 'object' && c.statusCode != null) ?? err;
  const statusCode = payload?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
  const message = Array.isArray(payload?.message)
    ? payload.message.join(', ')
    : payload?.message ?? 'Internal server error';
  const error = payload?.error ?? 'Error';
  return throwError(() => new HttpException({ statusCode, message, error }, statusCode));
}

@Controller('workflows')
export class WorkflowsController {
  constructor(
    @Inject(MICROSERVICES_CLIENTS.WORKFLOW_SERVICE)
    private workflowClient: ClientProxy,
  ) {}

  // ─── Templates ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('templates')
  async createTemplate(@Req() req: Request, @Body() body: any) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.workflowClient
        .send('workflows.template.create', { ...body, tenantDomain })
        .pipe(catchError(rpcError)),
    );
  }

  /**
   * Idempotent seed for STUDENT_ADMISSION_V1 (Chandananda SRS 4-step).
   * Safe to call repeatedly — replaces steps if template already exists.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('seed-student-admission')
  async seedStudentAdmission(@Req() req: Request) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.workflowClient
        .send('workflows.seed.studentAdmission', { tenantDomain })
        .pipe(catchError(rpcError)),
    );
  }

  /**
   * Idempotent seed for TEACHER_REGISTRATION_CHANDANANDA (3-step SRS).
   * Safe to call repeatedly — replaces steps if template already exists.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('seed-teacher-chandananda')
  async seedChandanandaTeacher(@Req() req: Request) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.workflowClient
        .send('workflows.seed.chandanandaTeacher', { tenantDomain })
        .pipe(catchError(rpcError)),
    );
  }

  /**
   * Idempotent seed for TEACHER_RECRUITMENT_V1 (Archdiocese 9-step).
   * Safe to call repeatedly — replaces steps if template already exists.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('seed-teacher-recruitment')
  async seedTeacherRecruitment(@Req() req: Request) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.workflowClient
        .send('workflows.seed.teacherRecruitment', { tenantDomain })
        .pipe(catchError(rpcError)),
    );
  }

  // ─── Instances ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('instances/start')
  async startInstance(@Req() req: Request, @Body() body: any) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.workflowClient
        .send('workflows.instance.start', { ...body, tenantDomain })
        .pipe(catchError(rpcError)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('instances/cancel')
  async cancelInstance(@Req() req: Request, @Body() body: any) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.workflowClient
        .send('workflows.instance.cancel', { ...body, tenantDomain })
        .pipe(catchError(rpcError)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('instances/mark-registered')
  async markRegistered(@Req() req: Request, @Body() body: any) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.workflowClient
        .send('workflows.instance.markRegistered', { ...body, tenantDomain })
        .pipe(catchError(rpcError)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('instances/by-reference/:businessReference')
  async getInstanceByReference(
    @Req() req: Request,
    @Param('businessReference') businessReference: string,
    @Query('templateCode') templateCode?: string,
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.workflowClient
        .send('workflows.instance.getByReference', {
          businessReference,
          tenantDomain,
          ...(templateCode && { templateCode }),
        })
        .pipe(catchError(rpcError)),
    );
  }

  // ─── Task queries ─────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('tasks/pending')
  async listPendingTasks(
    @Req() req: Request,
    @Query('schoolId') schoolId?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('requiredRole') requiredRole?: string,
    @Query('templateCode') templateCode?: string,
    @Query('module') module?: string,
    @Query('instanceId') instanceId?: string,
    @Query('businessReference') businessReference?: string,
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.workflowClient
        .send('workflows.tasks.pending', {
          tenantDomain,
          ...(schoolId && { schoolId: Number(schoolId) }),
          ...(assignedToUserId && { assignedToUserId: Number(assignedToUserId) }),
          ...(requiredRole && { requiredRole }),
          ...(templateCode && { templateCode }),
          ...(module && { module }),
          ...(instanceId && { instanceId: Number(instanceId) }),
          ...(businessReference && { businessReference }),
        })
        .pipe(catchError(rpcError)),
    );
  }

  // ─── Task actions ─────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:taskId/complete')
  async completeTask(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Body() body: { action: 'APPROVE' | 'REJECT'; actorUserId: number; comment?: string },
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const callerRole = (req as any).user?.role as string | undefined;

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.complete', {
          taskId: Number(taskId),
          tenantDomain,
          callerRole,
          ...body,
        })
        .pipe(catchError(rpcError)),
    );
  }

  /**
   * Hard-reject any task (any step type) with a required reason.
   * Marks instance REJECTED and bulk-cancels remaining PENDING tasks.
   */
  @UseGuards(JwtAuthGuard)
  @Post('tasks/:taskId/reject')
  async rejectTask(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Body() body: { actorUserId: number; reason: string },
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const callerRole = (req as any).user?.role as string | undefined;

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.reject', {
          taskId: Number(taskId),
          tenantDomain,
          callerRole,
          ...body,
        })
        .pipe(catchError(rpcError)),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('tasks/:taskId/assign')
  async assignTask(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Body() body: { assignToUserId: number; assignedByUserId: number },
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.assign', {
          taskId: Number(taskId),
          tenantDomain,
          ...body,
        })
        .pipe(catchError(rpcError)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:taskId/claim')
  async claimTask(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Body() body: { claimantUserId: number },
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const callerRole = (req as any).user?.role as string | undefined;

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.claim', {
          taskId: Number(taskId),
          tenantDomain,
          callerRole,
          ...body,
        })
        .pipe(catchError(rpcError)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:taskId/complete-non-approval')
  async completeNonApprovalTask(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Body() body: {
      actorUserId: number;
      result: 'DONE' | 'FAILED';
      comment?: string;
      payload?: any;
    },
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const callerRole = (req as any).user?.role as string | undefined;

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.completeNonApproval', {
          taskId: Number(taskId),
          tenantDomain,
          callerRole,
          ...body,
        })
        .pipe(catchError(rpcError)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:taskId/skip')
  async skipOptionalTask(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Body() body: { actorUserId: number },
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const callerRole = (req as any).user?.role as string | undefined;

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.skipOptional', {
          taskId: Number(taskId),
          tenantDomain,
          callerRole,
          ...body,
        })
        .pipe(catchError(rpcError)),
    );
  }

  // ─── Interview endpoints ───────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:taskId/trigger-interview')
  async triggerInterview(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      actorUserId: number;
      comment?: string;
      payload: {
        interview: {
          meetingProvider: 'ZOOM' | 'GOOGLE_MEET' | 'MS_TEAMS' | 'CUSTOM';
          meetingUrl: string;
          scheduledAt: string;
          recipients: { userId: number; email: string }[];
          notes?: string;
        };
      };
    },
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const callerRole = (req as any).user?.role as string | undefined;

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.updateInterviewLink', {
          taskId: Number(taskId),
          tenantDomain,
          callerRole,
          actorUserId: body.actorUserId,
          comment: body.comment,
          payload: body.payload,
        })
        .pipe(catchError(rpcError)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:taskId/interview-result')
  async recordInterviewResult(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      actorUserId: number;
      comment?: string;
      payload: {
        interviewOutcome: 'PASSED' | 'FAILED' | 'NO_SHOW' | 'RESCHEDULE' | 'PENDING';
        score?: number;
        completedAt?: string;
        provider?: string;
        meetingUrl?: string;
        notes?: string;
      };
    },
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const callerRole = (req as any).user?.role as string | undefined;

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.completeNonApproval', {
          taskId: Number(taskId),
          tenantDomain,
          callerRole,
          actorUserId: body.actorUserId,
          result: 'DONE' as const,
          comment: body.comment,
          payload: body.payload,
          requiredStepType: 'INTERVIEW',
        })
        .pipe(catchError(rpcError)),
    );
  }
}
