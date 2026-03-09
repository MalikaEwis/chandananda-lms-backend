import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { Request } from 'express';
import { MICROSERVICES_CLIENTS } from 'src/constants';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';

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

@Controller('attendance')
export class AttendanceController {
  constructor(
    @Inject(MICROSERVICES_CLIENTS.ATTENDANCE_SERVICE)
    private attendanceClient: ClientProxy,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER', 'ADMIN', 'PRINCIPAL')
  @Post('mark')
  async mark(@Req() req: Request, @Body() body: any) {
    const tenantDomain = body.tenantDomain ?? req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.attendanceClient
        .send('attendance.mark', { ...body, tenantDomain })
        .pipe(catchError(rpcError)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  async summary(
    @Req() req: Request,
    @Query('date') date: string,
    @Query('tenantDomain') tenantDomainQuery?: string,
  ) {
    const tenantDomain = tenantDomainQuery ?? req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.attendanceClient
        .send('attendance.summary.daily', { tenantDomain, date })
        .pipe(catchError(rpcError)),
    );
  }
}
