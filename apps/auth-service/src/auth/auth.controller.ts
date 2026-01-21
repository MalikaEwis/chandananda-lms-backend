import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern('auth.register')
  register(@Payload() dto: RegisterAuthDto) {
    return this.auth.register(dto);
  }

  @MessagePattern('auth.login')
  login(@Payload() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @MessagePattern('auth.refresh')
  refresh(@Payload() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
