import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersController } from './users/users.controller';
import { MicroservicesModule } from './microservices/microservices.module';

@Module({
  imports: [MicroservicesModule, AuthModule],
  controllers: [AppController, UsersController],
  providers: [AppService],
})
export class AppModule {}
