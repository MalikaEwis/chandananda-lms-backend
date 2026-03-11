import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AttendanceService } from './attendance.service';
import type { MarkAttendancePayload, DailySummaryPayload, ParentAttendanceSummaryPayload } from './attendance.service';

@Controller()
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @MessagePattern('attendance.mark')
  mark(@Payload() payload: MarkAttendancePayload) {
    return this.service.markAttendance(payload);
  }

  @MessagePattern('attendance.summary.daily')
  summary(@Payload() payload: DailySummaryPayload) {
    return this.service.getDailySummary(payload);
  }

  @MessagePattern('attendance.parent.summary')
  parentSummary(@Payload() payload: ParentAttendanceSummaryPayload) {
    return this.service.getParentAttendanceSummary(payload);
  }
}
