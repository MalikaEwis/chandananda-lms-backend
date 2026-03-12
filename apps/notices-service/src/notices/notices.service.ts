import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notice } from './entities/notice.entity';

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(Notice)
    private noticeRepository: Repository<Notice>,
  ) {}

  async createNotice(payload: {
    tenantDomain: string;
    title: string;
    content: string;
    category?: string;
    publishedByUserId: string;
    targetAudience?: { roles?: string[]; classes?: string[]; all?: boolean } | null;
    expiresAt?: string;
  }) {
    const notice = this.noticeRepository.create({
      tenantDomain: payload.tenantDomain,
      title: payload.title,
      content: payload.content,
      category: payload.category ?? 'GENERAL',
      publishedByUserId: payload.publishedByUserId,
      publishedAt: new Date(),
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      targetAudience: payload.targetAudience ?? null,
    });
    const saved = await this.noticeRepository.save(notice);
    console.log(`[notices] Published: "${payload.title}" id=${saved.id} by=${payload.publishedByUserId} audience=${JSON.stringify(payload.targetAudience)}`);
    return saved;
  }

  async getMyNotices(payload: {
    tenantDomain: string;
    userId: string;
    role: string;
    studentIds?: string[];
  }) {
    const { tenantDomain, role } = payload;

    console.log(`[notices] getMyNotices → tenantDomain=${tenantDomain} userId=${payload.userId} role=${role}`);

    const qb = this.noticeRepository.createQueryBuilder('notice');
    qb.where('notice.tenantDomain = :tenantDomain', { tenantDomain });
    qb.andWhere('notice.publishedAt <= NOW()');
    qb.andWhere('(notice.expiresAt IS NULL OR notice.expiresAt >= NOW())');

    // Audience match:
    //   • targetAudience IS NULL  → broadcast to everyone
    //   • targetAudience->>"$.all" = 'true'  → explicit broadcast flag
    //   • JSON_CONTAINS(targetAudience, JSON_QUOTE(:role), '$.roles')  → role in roles array
    // The 3-arg JSON_CONTAINS(doc, val, path) returns NULL (not 0) when path is absent,
    // so we wrap it in IFNULL(..., 0) to avoid dropping rows where $.roles is missing.
    qb.andWhere(
      '(' +
        'notice.targetAudience IS NULL ' +
        'OR notice.targetAudience->>"$.all" = \'true\' ' +
        'OR IFNULL(JSON_CONTAINS(notice.targetAudience, JSON_QUOTE(:role), \'$.roles\'), 0) = 1' +
        ')',
      { role },
    );

    qb.orderBy('notice.publishedAt', 'DESC');
    qb.limit(50);

    const notices = await qb.getMany();
    console.log(`[notices] getMyNotices → found ${notices.length} notice(s) for role=${role}`);
    return notices;
  }

  async getNoticesByParent(payload: {
    tenantDomain: string;
    parentUserId: number;
    studentIds: number[];
  }) {
    const { tenantDomain } = payload;

    console.log(`[notices] getNoticesByParent → parentUserId=${payload.parentUserId} studentIds=${JSON.stringify(payload.studentIds)}`);

    const qb = this.noticeRepository.createQueryBuilder('notice');
    qb.where('notice.tenantDomain = :tenantDomain', { tenantDomain });
    qb.andWhere('notice.publishedAt <= NOW()');
    qb.andWhere('(notice.expiresAt IS NULL OR notice.expiresAt >= NOW())');
    qb.andWhere(
      '(' +
        'notice.targetAudience IS NULL ' +
        'OR notice.targetAudience->>"$.all" = \'true\' ' +
        'OR IFNULL(JSON_CONTAINS(notice.targetAudience, JSON_QUOTE(:role), \'$.roles\'), 0) = 1' +
        ')',
      { role: 'PARENT' },
    );
    qb.orderBy('notice.publishedAt', 'DESC');
    qb.limit(50);

    const notices = await qb.getMany();
    console.log(`[notices] getNoticesByParent → found ${notices.length} notice(s)`);
    return notices;
  }
}
