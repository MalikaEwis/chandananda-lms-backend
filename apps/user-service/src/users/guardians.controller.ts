import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GuardiansService } from './guardians.service';

@Controller()
export class GuardiansController {
  constructor(private readonly service: GuardiansService) {}

  @MessagePattern('guardians.getStudents')
  getStudents(@Payload() payload: { parentUserId: number; tenantDomain: string }) {
    return this.service.getStudentsForParent(payload.parentUserId, payload.tenantDomain);
  }

  @MessagePattern('guardians.link')
  link(
    @Payload()
    payload: {
      parentUserId: number;
      studentId: number;
      relationship: 'MOTHER' | 'FATHER' | 'GUARDIAN';
      isPrimary: boolean;
      tenantDomain: string;
    },
  ) {
    return this.service.linkParentToStudent(payload);
  }
}
