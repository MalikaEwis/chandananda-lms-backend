import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MICROSERVICES_CLIENTS } from './constants';
import { AuthController } from './auth/auth.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: MICROSERVICES_CLIENTS.AUTH_SERVICE,
        transport: Transport.TCP,
        options: {
          port: 4001,
        },
      },

      {
        name: MICROSERVICES_CLIENTS.USERS_SERVICE,
        transport: Transport.TCP,
        options: {
          port: 4002,
        },
      },

      {
        name: MICROSERVICES_CLIENTS.WORKFLOW_SERVICE,
        transport: Transport.TCP,
        options: {
          port: 4003,
        },
      },
    ]),
  ],
  controllers: [AppController, AuthController],
  providers: [AppService],
})
export class AppModule {}
