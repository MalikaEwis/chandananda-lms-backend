import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignSchoolDto } from './dto/assign-school.dto';
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
  findByEmail(
    @Payload() payload: string | { email: string; tenantDomain?: string },
  ) {
    // Support both old (string) and new (object) payload formats
    if (typeof payload === 'string') {
      // Old format: plain email string
      return this.users.findByEmail(payload, 'cc.lk');
    } else {
      // New format: object with email and optional tenantDomain
      const tenantDomain = payload.tenantDomain
        ? payload.tenantDomain.trim().toLowerCase()
        : 'cc.lk';
      return this.users.findByEmail(payload.email, tenantDomain);
    }
  }

  @MessagePattern('users.updateStatus')
  updateStatus(
    @Payload() data: { userId: number; status: 'ACTIVE' | 'INACTIVE' },
  ) {
    return this.users.updateStatus(data.userId, data.status);
  }

  @MessagePattern('users.assignSchool')
  assignSchool(@Payload() dto: AssignSchoolDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';
    return this.users.assignSchool(dto.userId, dto.schoolId, tenantDomain);
  }

  @MessagePattern('users.getMySchools')
  getMySchools(
    @Payload() payload: { userId: number; tenantDomain?: string },
  ) {
    return this.users.getMySchools(payload.userId, payload.tenantDomain);
  }

  @MessagePattern('schools.listUsers')
  listUsersBySchool(
    @Payload() payload: { schoolId: number; tenantDomain?: string },
  ) {
    return this.users.listUsersBySchool(payload.schoolId, payload.tenantDomain);
  }

  @MessagePattern('users.list')
  listUsers(
    @Payload() payload: { tenantDomain?: string; schoolId?: number },
  ) {
    return this.users.listUsers(payload.tenantDomain, payload.schoolId);
  }

  @MessagePattern('users.findByRole')
  findByRole(@Payload() payload: { role: string; tenantDomain?: string }) {
    const tenantDomain = payload.tenantDomain?.trim().toLowerCase() ?? 'cc.lk';
    return this.users.findByRole(payload.role, tenantDomain);
  }
}
