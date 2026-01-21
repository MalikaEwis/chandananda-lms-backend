import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller('auth')
export class AuthController {
  @MessagePattern('create_auth')
  createAuth(auth: any) {
    console.log({ message: 'Auth data received on the Microservice:', auth });
    return { message: 'Auth created ', auth };
  }
}
