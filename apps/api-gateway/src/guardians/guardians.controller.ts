import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
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

@Controller('guardians')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class GuardiansController {
  constructor(
    @Inject(MICROSERVICES_CLIENTS.USERS_SERVICE)
    private usersClient: ClientProxy,
  ) {}

  /**
   * Link a parent user to a student.
   * Body: { parentUserId, studentId, relationship?, isPrimary?, tenantDomain? }
   * relationship defaults to 'GUARDIAN'; isPrimary defaults to false.
   */
  @Post('link')
  async link(
    @Req() req: Request,
    @Body()
    body: {
      parentUserId: number;
      studentId: number;
      relationship?: 'MOTHER' | 'FATHER' | 'GUARDIAN';
      isPrimary?: boolean;
      tenantDomain?: string;
    },
  ) {
    const tenantDomain = body.tenantDomain ?? req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.usersClient
        .send('guardians.link', {
          parentUserId: body.parentUserId,
          studentId: body.studentId,
          relationship: body.relationship ?? 'GUARDIAN',
          isPrimary: body.isPrimary ?? false,
          tenantDomain,
        })
        .pipe(catchError(rpcError)),
    );
  }
}
