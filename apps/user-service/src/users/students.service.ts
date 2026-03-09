import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './entities/student.entity';
import type { FindOptionsWhere } from 'typeorm';

export interface CreateStudentPayload {
  businessReference: string;
  tenantDomain: string;
  admissionNo: string;
}

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private repo: Repository<Student>,
  ) {}

  async create(payload: CreateStudentPayload): Promise<{ id: number; admissionNo: string }> {
    const tenantDomain = payload.tenantDomain
      ? payload.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    console.log('Creating student from ref:', payload.businessReference);

    const student = await this.repo.save(
      this.repo.create({
        admissionNo: payload.admissionNo,
        businessReference: payload.businessReference,
        tenantDomain,
        status: 'PENDING',
      }),
    );

    console.log('Student created:', student);
    return { id: student.id, admissionNo: student.admissionNo };
  }

  async findAll(query: {
    tenantDomain: string;
    admissionNo?: string;
  }): Promise<Student[]> {
    const tenantDomain = query.tenantDomain
      ? query.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    console.log('Listing students for tenant:', tenantDomain);

    const where: FindOptionsWhere<Student> = { tenantDomain };
    if (query.admissionNo) where.admissionNo = query.admissionNo;

    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
