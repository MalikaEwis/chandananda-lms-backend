import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';

@Controller()
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @MessagePattern('schools.create')
  create(@Payload() dto: CreateSchoolDto) {
    return this.schools.create(dto);
  }

  @MessagePattern('schools.list')
  list(@Payload() payload: { tenantDomain?: string }) {
    return this.schools.list(payload.tenantDomain);
  }

  @MessagePattern('schools.getById')
  getById(@Payload() payload: { id: number; tenantDomain?: string }) {
    return this.schools.getById(payload.id, payload.tenantDomain);
  }
}
