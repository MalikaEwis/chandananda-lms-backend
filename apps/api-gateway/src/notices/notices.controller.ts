import {
  Body,
  Controller,
  Get,
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

@Controller('notices')
@UseGuards(JwtAuthGuard)
export class NoticesController {
  constructor(
    @Inject(MICROSERVICES_CLIENTS.NOTICES_SERVICE)
    private noticesClient: ClientProxy,
  ) {}

  /**
   * Publish a notice.
   * Roles: ADMIN, PRINCIPAL, TEACHER
   * Body: { title, content, category?, targetAudience?, expiresAt? }
   */
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'TEACHER')
  @Post()
  async create(
    @Req() req: Request,
    @Body()
    body: {
      title: string;
      content: string;
      category?: string;
      targetAudience?: { roles?: string[]; classes?: string[]; all?: boolean };
      expiresAt?: string;
    },
  ) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const user = (req as any).user;

    return firstValueFrom(
      this.noticesClient
        .send('notices.create', {
          tenantDomain,
          title: body.title,
          content: body.content,
          category: body.category ?? 'GENERAL',
          publishedByUserId: String(user?.userId ?? ''),
          targetAudience: body.targetAudience ?? null,
          expiresAt: body.expiresAt,
        })
        .pipe(catchError(rpcError)),
    );
  }

  /**
   * Get notices visible to the authenticated user.
   * All authenticated roles can call this.
   */
  @Get('my')
  async myNotices(@Req() req: Request) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';
    const user = (req as any).user;

    return firstValueFrom(
      this.noticesClient
        .send('notices.my', {
          tenantDomain,
          userId: String(user?.userId ?? ''),
          role: user?.role ?? '',
        })
        .pipe(catchError(rpcError)),
    );
  }
}
