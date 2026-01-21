import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthAccount } from './entities/auth-account.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginDto } from './dto/login.dto';
import { IsNull } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthAccount) private authRepo: Repository<AuthAccount>,
    @InjectRepository(RefreshToken)
    private refreshRepo: Repository<RefreshToken>,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  private async hashToken(token: string) {
    // bcrypt is fine here too; keeps it simple
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
    const expiresIn = this.cfg.get<string>('JWT_ACCESS_EXPIRES') ?? '15m';
    const secret = this.cfg.get<string>('JWT_ACCESS_SECRET');
    return this.jwt.sign(payload as any, { secret, expiresIn } as any);
  }

  private signRefreshToken(payload: { sub: number; email: string }) {
    const expiresIn = this.cfg.get<string>('JWT_REFRESH_EXPIRES') ?? '7d';
    const secret = this.cfg.get<string>('JWT_REFRESH_SECRET');
    return this.jwt.sign(payload as any, { secret, expiresIn } as any);
  }

  async register(dto: RegisterAuthDto) {
    const exists = await this.authRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const account = await this.authRepo.save({
      email: dto.email,
      userId: dto.userId,
      passwordHash,
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    const accessToken = this.signAccessToken({
      sub: account.userId,
      email: account.email,
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
    const account = await this.authRepo.findOne({
      where: { email: dto.email },
    });
    if (!account) throw new UnauthorizedException('Invalid credentials');

    if (account.status !== 'ACTIVE')
      throw new UnauthorizedException('Account not active');

    const ok = await bcrypt.compare(dto.password, account.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const accessToken = this.signAccessToken({
      sub: account.userId,
      email: account.email,
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

    // find latest non-revoked refresh tokens for this account
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
    });
    const newRefreshToken = this.signRefreshToken({
      sub: account.userId,
      email: account.email,
    });

    // revoke old token (simple rotation)
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
