import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Returns notices visible to a parent: global notices + notices targeting
   * the parent's linked students. Full implementation pending notices DB setup.
   */
  @MessagePattern('notices.parent.my')
  getParentNotices(
    @Payload() _payload: { parentUserId: number; studentIds: number[]; tenantDomain: string },
  ) {
    console.log('notices.parent.my called — notices DB not yet seeded, returning []');
    return [];
  }
}
