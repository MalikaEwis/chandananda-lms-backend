import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NoticesService } from './notices.service';

@Controller()
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @MessagePattern('notices.create')
  create(
    @Payload()
    payload: {
      tenantDomain: string;
      title: string;
      content: string;
      category?: string;
      publishedByUserId: string;
      targetAudience?: { roles?: string[]; classes?: string[]; all?: boolean } | null;
      expiresAt?: string;
    },
  ) {
    return this.noticesService.createNotice(payload);
  }

  @MessagePattern('notices.my')
  myNotices(
    @Payload()
    payload: {
      tenantDomain: string;
      userId: string;
      role: string;
      studentIds?: string[];
    },
  ) {
    return this.noticesService.getMyNotices(payload);
  }

  @MessagePattern('notices.parent.my')
  parentNotices(
    @Payload()
    payload: {
      tenantDomain: string;
      parentUserId: number;
      studentIds: number[];
    },
  ) {
    return this.noticesService.getNoticesByParent(payload);
  }
}
