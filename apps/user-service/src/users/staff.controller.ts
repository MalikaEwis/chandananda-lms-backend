import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StaffService } from './staff.service';
import type { CreateStaffFromRecruitmentPayload, CreateStaffFromRegistrationPayload } from './staff.service';

@Controller()
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @MessagePattern('staff.list')
  list(@Payload() payload: { tenantDomain: string; teacherIdentificationNumber?: string }) {
    return this.staff.findAll(payload);
  }

  @MessagePattern('staff.createFromRecruitment')
  createFromRecruitment(@Payload() payload: CreateStaffFromRecruitmentPayload) {
    return this.staff.createStaffFromRecruitment(payload);
  }

  @MessagePattern('staff.createFromRegistration')
  createFromRegistration(@Payload() payload: CreateStaffFromRegistrationPayload) {
    return this.staff.createStaffFromRegistration(payload);
  }
}
