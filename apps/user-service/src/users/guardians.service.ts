import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guardian } from './entities/guardian.entity';
import { Student } from './entities/student.entity';

@Injectable()
export class GuardiansService {
  constructor(
    @InjectRepository(Guardian)
    private guardianRepo: Repository<Guardian>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
  ) {}

  /**
   * Returns all students linked to a parent user, with their basic info.
   */
  async getStudentsForParent(
    parentUserId: number,
    tenantDomain: string,
  ): Promise<Array<{ studentId: number; admissionNo: string; businessReference: string; relationship: string; isPrimary: boolean }>> {
    const links = await this.guardianRepo.find({
      where: { parentUserId, tenantDomain },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });

    if (links.length === 0) return [];

    const studentIds = links.map((l) => l.studentId);
    const students = await this.studentRepo.findByIds(studentIds);
    const studentMap = new Map(students.map((s) => [s.id, s]));

    return links
      .filter((l) => studentMap.has(l.studentId))
      .map((l) => {
        const s = studentMap.get(l.studentId)!;
        return {
          studentId: s.id,
          admissionNo: s.admissionNo,
          businessReference: s.businessReference,
          relationship: l.relationship,
          isPrimary: l.isPrimary,
        };
      });
  }

  /** Create a guardian link (for seeding/admin) */
  async linkParentToStudent(payload: {
    parentUserId: number;
    studentId: number;
    relationship: 'MOTHER' | 'FATHER' | 'GUARDIAN';
    isPrimary: boolean;
    tenantDomain: string;
  }): Promise<Guardian> {
    const existing = await this.guardianRepo.findOne({
      where: {
        parentUserId: payload.parentUserId,
        studentId: payload.studentId,
        tenantDomain: payload.tenantDomain,
      },
    });
    if (existing) {
      existing.relationship = payload.relationship;
      existing.isPrimary = payload.isPrimary;
      return this.guardianRepo.save(existing);
    }
    return this.guardianRepo.save(this.guardianRepo.create(payload));
  }
}
