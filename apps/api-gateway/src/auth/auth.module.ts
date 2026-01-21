import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { MicroservicesModule } from 'src/microservices/microservices.module';

@Module({
  imports: [PassportModule, MicroservicesModule],
  controllers: [AuthController],
  providers: [JwtStrategy],
})
export class AuthModule {}
