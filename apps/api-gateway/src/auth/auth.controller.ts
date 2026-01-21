import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MICROSERVICES_CLIENTS } from 'src/constants';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(MICROSERVICES_CLIENTS.AUTH_SERVICE)
    private authServiceClient: ClientProxy,
  ) {}

  @Post()
  createAuth(@Body() auth: any) {
    return this.authServiceClient.send('create_auth', auth);
  }
}
