import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @MessagePattern('users.create')
  create(@Payload() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @MessagePattern('users.findById')
  findById(@Payload() id: number) {
    return this.users.findById(id);
  }

  @MessagePattern('users.findByEmail')
  findByEmail(@Payload() email: string) {
    return this.users.findByEmail(email);
  }
}
