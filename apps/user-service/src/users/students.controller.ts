import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StudentsService } from './students.service';
import type { CreateStudentPayload } from './students.service';

@Controller()
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @MessagePattern('students.create')
  create(@Payload() payload: CreateStudentPayload) {
    return this.students.create(payload);
  }

  @MessagePattern('students.list')
  list(@Payload() payload: { tenantDomain: string; admissionNo?: string }) {
    return this.students.findAll(payload);
  }
}
