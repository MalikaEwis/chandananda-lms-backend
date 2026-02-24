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

// Shared error extractor — handles all three RpcException shapes
function rpcError(err: any) {
  const payload = err?.error?.error ?? err?.error ?? err;
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

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.complete', {
          taskId: Number(taskId),
          tenantDomain,
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

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.claim', {
          taskId: Number(taskId),
          tenantDomain,
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

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.completeNonApproval', {
          taskId: Number(taskId),
          tenantDomain,
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

    return firstValueFrom(
      this.workflowClient
        .send('workflows.task.skipOptional', {
          taskId: Number(taskId),
          tenantDomain,
          ...body,
        })
        .pipe(catchError(rpcError)),
    );
  }
}
