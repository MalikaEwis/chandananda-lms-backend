import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MICROSERVICES_CLIENTS } from 'src/constants';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: MICROSERVICES_CLIENTS.AUTH_SERVICE,
        transport: Transport.TCP,
        options: { port: 4001 },
      },
      {
        name: MICROSERVICES_CLIENTS.USERS_SERVICE,
        transport: Transport.TCP,
        options: { port: 4002 },
      },
      {
        name: MICROSERVICES_CLIENTS.WORKFLOW_SERVICE,
        transport: Transport.TCP,
        options: { port: 4003 },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class MicroservicesModule {}
