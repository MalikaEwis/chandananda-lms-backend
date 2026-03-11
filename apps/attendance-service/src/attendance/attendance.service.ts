import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { AttendanceRecord } from './entities/attendance-record.entity';

export interface MarkAttendancePayload {
  tenantDomain: string;
  studentId?: string;
  staffId?: string;
  date: string; // YYYY-MM-DD
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  markedByUserId: string;
  notes?: string;
}

export interface DailySummaryPayload {
  tenantDomain: string;
  date: string; // YYYY-MM-DD
}

export interface ParentAttendanceSummaryPayload {
  tenantDomain: string;
  studentIds: number[];
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private repo: Repository<AttendanceRecord>,
  ) {}

  async markAttendance(payload: MarkAttendancePayload): Promise<AttendanceRecord> {
    const { tenantDomain, studentId, staffId, status, markedByUserId, notes } = payload;

    if (!studentId && !staffId) {
      throw new RpcException({
        statusCode: 400,
        message: 'Either studentId or staffId must be provided',
        error: 'Bad Request',
      });
    }
    if (studentId && staffId) {
      throw new RpcException({
        statusCode: 400,
        message: 'Only one of studentId or staffId may be provided, not both',
        error: 'Bad Request',
      });
    }

    // Normalize to plain YYYY-MM-DD string — avoids all timezone/time-component issues
    const normalizedDate = new Date(payload.date).toISOString().split('T')[0];
    // Store as midnight UTC so the MySQL DATE column receives exactly YYYY-MM-DD
    const dateObj = new Date(normalizedDate + 'T00:00:00.000Z');
    const subjectId = studentId || staffId;

    // Upsert: find existing record using DATE() to ignore any stored time component
    const qb = this.repo
      .createQueryBuilder('ar')
      .where('ar.tenantDomain = :tenantDomain', { tenantDomain })
      .andWhere('DATE(ar.date) = :date', { date: normalizedDate });

    if (studentId) {
      qb.andWhere('ar.studentId = :studentId', { studentId });
    } else {
      qb.andWhere('ar.staffId = :staffId', { staffId });
    }

    let record = await qb.getOne();

    if (record) {
      record.status = status;
      record.markedByUserId = markedByUserId;
      record.markedAt = new Date();
      record.notes = notes ?? null;
    } else {
      record = this.repo.create({
        tenantDomain,
        studentId: studentId ?? null,
        staffId: staffId ?? null,
        date: dateObj,
        status,
        markedByUserId,
        markedAt: new Date(),
        notes: notes ?? null,
      });
    }

    const saved = await this.repo.save(record);
    console.log(`Attendance marked for ${subjectId} on ${normalizedDate} by ${markedByUserId}: ${status}`);
    return saved;
  }

  async getDailySummary(payload: DailySummaryPayload): Promise<{
    date: string;
    tenantDomain: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  }> {
    const { tenantDomain } = payload;
    // Normalize the incoming date string the same way
    const normalizedDate = new Date(payload.date).toISOString().split('T')[0];

    // Reusable query builder using DATE() so the comparison is time-agnostic
    const base = () =>
      this.repo
        .createQueryBuilder('ar')
        .where('ar.tenantDomain = :tenantDomain', { tenantDomain })
        .andWhere('DATE(ar.date) = :date', { date: normalizedDate });

    const [total, present, absent, late, excused] = await Promise.all([
      base().getCount(),
      base().andWhere('ar.status = :s', { s: 'PRESENT' }).getCount(),
      base().andWhere('ar.status = :s', { s: 'ABSENT' }).getCount(),
      base().andWhere('ar.status = :s', { s: 'LATE' }).getCount(),
      base().andWhere('ar.status = :s', { s: 'EXCUSED' }).getCount(),
    ]);

    console.log(`Summary query for date: ${normalizedDate}, tenantDomain: ${tenantDomain}, found ${total} records`);

    return { date: normalizedDate, tenantDomain, total, present, absent, late, excused };
  }

  async getParentAttendanceSummary(payload: ParentAttendanceSummaryPayload): Promise<
    Array<{
      studentId: number;
      dateFrom: string;
      dateTo: string;
      records: Array<{ date: string; status: string; notes: string | null }>;
      summary: { total: number; present: number; absent: number; late: number; excused: number };
    }>
  > {
    const { tenantDomain, studentIds, dateFrom, dateTo } = payload;
    const normFrom = new Date(dateFrom).toISOString().split('T')[0];
    const normTo = new Date(dateTo).toISOString().split('T')[0];

    console.log(`Parent attendance query: studentIds=[${studentIds}] from=${normFrom} to=${normTo}`);

    const results = await Promise.all(
      studentIds.map(async (studentId) => {
        const rows = await this.repo
          .createQueryBuilder('ar')
          .where('ar.tenantDomain = :tenantDomain', { tenantDomain })
          .andWhere('ar.studentId = :studentId', { studentId: String(studentId) })
          .andWhere('DATE(ar.date) >= :from', { from: normFrom })
          .andWhere('DATE(ar.date) <= :to', { to: normTo })
          .orderBy('ar.date', 'ASC')
          .getMany();

        const records = rows.map((r) => ({
          date: new Date(r.date).toISOString().split('T')[0],
          status: r.status,
          notes: r.notes,
        }));

        const summary = {
          total: rows.length,
          present: rows.filter((r) => r.status === 'PRESENT').length,
          absent: rows.filter((r) => r.status === 'ABSENT').length,
          late: rows.filter((r) => r.status === 'LATE').length,
          excused: rows.filter((r) => r.status === 'EXCUSED').length,
        };

        return { studentId, dateFrom: normFrom, dateTo: normTo, records, summary };
      }),
    );

    return results;
  }
}
