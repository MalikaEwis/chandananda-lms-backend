import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { MICROSERVICES_CLIENTS } from 'src/constants';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

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
    @Inject(MICROSERVICES_CLIENTS.AUTH_SERVICE) private authClient: ClientProxy,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await firstValueFrom(
      this.usersClient.send('users.create', {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      }),
    );

    const tokens = await firstValueFrom(
      this.authClient.send('auth.register', {
        email: dto.email,
        password: dto.password,
        userId: user.id,
      }),
    );

    return { user, ...tokens };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return firstValueFrom(this.authClient.send('auth.login', dto));
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return firstValueFrom(this.authClient.send('auth.refresh', dto));
  }
}
