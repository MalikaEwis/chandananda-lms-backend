import { BadRequestException, Injectable } from '@nestjs/common';
import { Inject, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';

import { AuthAccount } from './entities/auth-account.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthAccount) private authRepo: Repository<AuthAccount>,
    @InjectRepository(RefreshToken)
    private refreshRepo: Repository<RefreshToken>,
    @Inject('USER_SERVICE') private usersClient: ClientProxy,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  private unauthorized(message: string): never {
    throw new RpcException({ statusCode: 401, message, error: 'Unauthorized' });
  }

  private async hashToken(token: string) {
    return bcrypt.hash(token, 10);
  }

  private async verifyTokenHash(token: string, hash: string) {
    return bcrypt.compare(token, hash);
  }

  private signAccessToken(payload: {
    sub: number;
    email: string;
    role?: string;
  }) {
    const expiresIn = this.cfg.get<string>('JWT_ACCESS_EXPIRES') ?? '45m';
    const secret = this.cfg.get<string>('JWT_ACCESS_SECRET');
    return this.jwt.sign(payload as any, { secret, expiresIn } as any);
  }

  private signRefreshToken(payload: { sub: number; email: string }) {
    const expiresIn = this.cfg.get<string>('JWT_REFRESH_EXPIRES') ?? '7d';
    const secret = this.cfg.get<string>('JWT_REFRESH_SECRET');
    return this.jwt.sign(payload as any, { secret, expiresIn } as any);
  }

  async register(dto: RegisterAuthDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const exists = await this.authRepo.findOne({
      where: { email: dto.email, tenantDomain },
    });
    if (exists)
      throw new BadRequestException('Email already registered in this tenant');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const account = await this.authRepo.save({
      email: dto.email,
      tenantDomain,
      userId: dto.userId,
      passwordHash,
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      role: dto.role ?? null,
    });

    const accessToken = this.signAccessToken({
      sub: account.userId,
      email: account.email,
      role: account.role ?? undefined,
    });

    const refreshToken = this.signRefreshToken({
      sub: account.userId,
      email: account.email,
    });

    const refreshHash = await this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshRepo.save({
      authAccountId: account.id,
      tokenHash: refreshHash,
      expiresAt,
      revokedAt: null,
    });

    return {
      userId: account.userId,
      email: account.email,
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto) {
    try {
      const tenantDomain = dto.tenantDomain
        ? dto.tenantDomain.trim().toLowerCase()
        : 'cc.lk';

      // 1) Find auth account by email and tenantDomain
      const account = await this.authRepo.findOne({
        where: { email: dto.email, tenantDomain },
      });
      if (!account) this.unauthorized('Invalid credentials');

      // 2) Block inactive auth accounts early
      if (account.status !== 'ACTIVE') this.unauthorized('Account not active');

      // 3) Check user-service status (source of truth for ACTIVE/INACTIVE)
      let user: any;
      try {
        user = await firstValueFrom(
          this.usersClient.send('users.findByEmail', {
            email: dto.email,
            tenantDomain,
          }),
        );
      } catch (err) {
        // Log the actual error for debugging
        console.error('User service error:', {
          message: err?.message,
          code: err?.code,
          stack: err?.stack,
        });

        // Throw appropriate error based on error type
        if (err?.code === 'ECONNREFUSED' || err?.message?.includes('connect')) {
          throw new RpcException({
            statusCode: 503,
            message: 'User service unavailable',
            error: 'ServiceUnavailable',
          });
        }

        this.unauthorized('User service unavailable');
      }

      if (!user) this.unauthorized('User profile not found');
      if (user.status !== 'ACTIVE') this.unauthorized('Account is inactive');

      // 4) Verify password
      const ok = await bcrypt.compare(dto.password, account.passwordHash);
      if (!ok) this.unauthorized('Invalid credentials');

      const accessToken = this.signAccessToken({
        sub: account.userId,
        email: account.email,
        role: account.role ?? undefined,
      });

      const refreshToken = this.signRefreshToken({
        sub: account.userId,
        email: account.email,
      });

      const refreshHash = await this.hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await this.refreshRepo.save({
        authAccountId: account.id,
        tokenHash: refreshHash,
        expiresAt,
        revokedAt: null,
      });

      return {
        userId: account.userId,
        email: account.email,
        accessToken,
        refreshToken,
      };
    } catch (err) {
      // If it's already an RpcException, re-throw it
      if (err instanceof RpcException) {
        throw err;
      }
      // Log unexpected errors
      console.error('Unexpected login error:', err);
      throw new RpcException({
        statusCode: 500,
        message: 'Internal server error',
        error: 'InternalServerError',
      });
    }
  }

  async refresh(refreshToken: string) {
    const secret = this.cfg.get<string>('JWT_REFRESH_SECRET');
    let payload: any;

    try {
      payload = this.jwt.verify(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const account = await this.authRepo.findOne({
      where: { userId: payload.sub, email: payload.email },
    });
    if (!account) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.refreshRepo.find({
      where: { authAccountId: account.id, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const match = await Promise.any(
      tokens.map(async (t) =>
        (await this.verifyTokenHash(refreshToken, t.tokenHash)) ? t : null,
      ),
    ).catch(() => null);

    if (!match) throw new UnauthorizedException('Refresh token not recognized');

    const accessToken = this.signAccessToken({
      sub: account.userId,
      email: account.email,
      role: account.role ?? undefined,
    });

    const newRefreshToken = this.signRefreshToken({
      sub: account.userId,
      email: account.email,
    });

    match.revokedAt = new Date();
    await this.refreshRepo.save(match);

    const refreshHash = await this.hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshRepo.save({
      authAccountId: account.id,
      tokenHash: refreshHash,
      expiresAt,
      revokedAt: null,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }
}
