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

@Controller('staff')
export class StaffController {
  constructor(
    @Inject(MICROSERVICES_CLIENTS.USERS_SERVICE)
    private usersClient: ClientProxy,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HR_EXEC')
  @Get()
  async list(
    @Req() req: Request,
    @Query('tin') teacherIdentificationNumber?: string,
    @Query('tenantDomain') tenantDomainQuery?: string,
  ) {
    const tenantDomain = tenantDomainQuery ?? req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.usersClient
        .send('staff.list', {
          tenantDomain,
          ...(teacherIdentificationNumber && { teacherIdentificationNumber }),
        })
        .pipe(catchError(rpcError)),
    );
  }
}
