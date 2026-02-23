import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { Request } from 'express';
import { MICROSERVICES_CLIENTS } from '../constants';
import { CreateSchoolDto } from './dto/create-school.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('schools')
export class SchoolsController {
  constructor(
    @Inject(MICROSERVICES_CLIENTS.USERS_SERVICE)
    private usersClient: ClientProxy,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.usersClient
        .send('schools.list', { tenantDomain })
        .pipe(
          catchError((err) => {
            // RpcException structure: { error: { error: { statusCode, message, error } } }
            const payload = err?.error?.error ?? err?.error ?? err;
            const statusCode =
              payload?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
            const message = Array.isArray(payload?.message)
              ? payload.message.join(', ')
              : payload?.message ?? 'Internal server error';
            const error = payload?.error ?? 'Error';

            return throwError(
              () =>
                new HttpException({ statusCode, message, error }, statusCode),
            );
          }),
        ),
    );
  }

  @Get(':id')
  async getById(@Req() req: Request, @Param('id') id: string) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.usersClient
        .send('schools.getById', {
          id: Number(id),
          tenantDomain,
        })
        .pipe(
          catchError((err) => {
            // RpcException structure: { error: { error: { statusCode, message, error } } }
            const payload = err?.error?.error ?? err?.error ?? err;
            const statusCode =
              payload?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
            const message = Array.isArray(payload?.message)
              ? payload.message.join(', ')
              : payload?.message ?? 'Internal server error';
            const error = payload?.error ?? 'Error';

            return throwError(
              () =>
                new HttpException({ statusCode, message, error }, statusCode),
            );
          }),
        ),
    );
  }

  @Get(':id/users')
  async listUsers(@Req() req: Request, @Param('id') id: string) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.usersClient
        .send('schools.listUsers', {
          schoolId: Number(id),
          tenantDomain,
        })
        .pipe(
          catchError((err) => {
            // RpcException structure: { error: { error: { statusCode, message, error } } }
            const payload = err?.error?.error ?? err?.error ?? err;
            const statusCode =
              payload?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
            const message = Array.isArray(payload?.message)
              ? payload.message.join(', ')
              : payload?.message ?? 'Internal server error';
            const error = payload?.error ?? 'Error';

            return throwError(
              () =>
                new HttpException({ statusCode, message, error }, statusCode),
            );
          }),
        ),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateSchoolDto) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    return firstValueFrom(
      this.usersClient
        .send('schools.create', {
          name: dto.name,
          code: dto.code,
          tenantDomain,
        })
        .pipe(
          catchError((err) => {
            // RpcException structure: { error: { error: { statusCode, message, error } } }
            const payload = err?.error?.error ?? err?.error ?? err;
            const statusCode =
              payload?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
            const message = Array.isArray(payload?.message)
              ? payload.message.join(', ')
              : payload?.message ?? 'Internal server error';
            const error = payload?.error ?? 'Error';

            return throwError(
              () =>
                new HttpException({ statusCode, message, error }, statusCode),
            );
          }),
        ),
    );
  }
}
