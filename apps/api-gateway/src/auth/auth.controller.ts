import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { MICROSERVICES_CLIENTS } from 'src/constants';

class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsIn(['ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT', 'STUDENT', 'STAFF'])
  role: string;
}

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}

class RefreshDto {
  @IsString() refreshToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(MICROSERVICES_CLIENTS.USERS_SERVICE)
    private usersClient: ClientProxy,
    @Inject(MICROSERVICES_CLIENTS.AUTH_SERVICE)
    private authClient: ClientProxy,
  ) {}

  @Post('register')
  async register(@Req() req: Request, @Body() dto: RegisterDto) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    const existingUser = await firstValueFrom(
      this.usersClient.send('users.findByEmail', {
        email: dto.email,
        tenantDomain,
      }),
    );

    const user =
      existingUser ??
      (await firstValueFrom(
        this.usersClient.send('users.create', {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          tenantDomain,
        }),
      ));

    return firstValueFrom(
      this.authClient
        .send('auth.register', {
          email: dto.email,
          password: dto.password,
          userId: user.id,
          role: dto.role,
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
    ).then((tokens) => ({ user, ...tokens }));
  }

  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const tenantDomain = req.tenantDomain ?? 'cc.lk';

    console.log('[API Gateway] Login request received for:', dto.email);
    return firstValueFrom(
      this.authClient
        .send('auth.login', {
          email: dto.email,
          password: dto.password,
          tenantDomain,
        })
        .pipe(
          catchError((err) => {
            // RpcException structure: { error: { error: { statusCode, message, error } } }
            console.log('[API Gateway] Error from auth service:', {
              error: err?.error,
              message: err?.message,
              fullError: err,
            });
            const payload = err?.error?.error ?? err?.error ?? err;
            const statusCode =
              payload?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
            const message = Array.isArray(payload?.message)
              ? payload.message.join(', ')
              : payload?.message ?? 'Internal server error';
            const error = payload?.error ?? 'Error';

            console.log('[API Gateway] Transformed error:', {
              statusCode,
              message,
              error,
            });
            return throwError(
              () =>
                new HttpException({ statusCode, message, error }, statusCode),
            );
          }),
        ),
    );
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return firstValueFrom(
      this.authClient.send('auth.refresh', dto).pipe(
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
            () => new HttpException({ statusCode, message, error }, statusCode),
          );
        }),
      ),
    );
  }
}
