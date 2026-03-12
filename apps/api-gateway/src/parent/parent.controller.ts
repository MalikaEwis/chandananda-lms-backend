import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
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

@Controller('parent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PARENT')
export class ParentController {
  constructor(
    @Inject(MICROSERVICES_CLIENTS.USERS_SERVICE)
    private usersClient: ClientProxy,
    @Inject(MICROSERVICES_CLIENTS.ATTENDANCE_SERVICE)
    private attendanceClient: ClientProxy,
    @Inject(MICROSERVICES_CLIENTS.NOTICES_SERVICE)
    private noticesClient: ClientProxy,
  ) {}

  /**
   * Returns attendance records for all of the authenticated parent's children
   * within the given date range.
   */
  @Get('attendance/my-child')
  async myChildAttendance(
    @Req() req: Request,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const parentUserId = (req as any).user?.userId as number;

    const normFrom = dateFrom ?? new Date().toISOString().split('T')[0];
    const normTo = dateTo ?? new Date().toISOString().split('T')[0];

    // 1. Resolve linked students from user-service
    const linkedStudents = await firstValueFrom(
      this.usersClient
        .send<Array<{ studentId: number; admissionNo: string; businessReference: string }>>(
          'guardians.getStudents',
          { parentUserId, tenantDomain },
        )
        .pipe(catchError(rpcError)),
    );

    if (!linkedStudents || linkedStudents.length === 0) {
      return { parentUserId, children: [], message: 'No linked students found' };
    }

    const studentIds = linkedStudents.map((s) => s.studentId);

    // 2. Fetch attendance per child from attendance-service
    const attendanceData = await firstValueFrom(
      this.attendanceClient
        .send('attendance.parent.summary', { tenantDomain, studentIds, dateFrom: normFrom, dateTo: normTo })
        .pipe(catchError(rpcError)),
    );

    // Merge student info with attendance data
    const infoMap = new Map(linkedStudents.map((s) => [s.studentId, s]));
    const children = (attendanceData as any[]).map((a) => ({
      ...infoMap.get(a.studentId),
      attendance: a,
    }));

    return { parentUserId, dateFrom: normFrom, dateTo: normTo, children };
  }

  /**
   * Returns notices visible to this parent and their linked children.
   */
  @Get('notices/my-child')
  async myChildNotices(@Req() req: Request) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const parentUserId = (req as any).user?.userId as number;

    // 1. Resolve linked students
    const linkedStudents = await firstValueFrom(
      this.usersClient
        .send<Array<{ studentId: number }>>('guardians.getStudents', { parentUserId, tenantDomain })
        .pipe(catchError(rpcError)),
    );

    const studentIds = (linkedStudents ?? []).map((s) => s.studentId);

    // 2. Fetch notices from notices-service (PARENT role filter, includes linked studentIds)
    const notices = await firstValueFrom(
      this.noticesClient
        .send('notices.my', {
          tenantDomain,
          userId: String(parentUserId),
          role: 'PARENT',
          studentIds: studentIds.map(String),
        })
        .pipe(catchError(rpcError)),
    );

    return { parentUserId, studentIds, notices };
  }
}
