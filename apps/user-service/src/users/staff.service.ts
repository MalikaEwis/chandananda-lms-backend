import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from './entities/staff.entity';
import type { FindOptionsWhere } from 'typeorm';

export interface CreateStaffFromRegistrationPayload {
  businessReference: string;
  tenantDomain: string;
  nameInFull?: string;
  nicNumber?: string;
}

export interface CreateStaffFromRecruitmentPayload {
  businessReference: string;
  tenantDomain: string;
  tinNumber: string;
  part1: number;
  part2: number;
  part3: number;
  part4: number;
}

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private repo: Repository<Staff>,
  ) {}

  async findAll(query: { tenantDomain: string; teacherIdentificationNumber?: string }): Promise<Staff[]> {
    const tenantDomain = query.tenantDomain
      ? query.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    console.log('Listing staff for tenant:', tenantDomain);

    const where: FindOptionsWhere<Staff> = { tenantDomain };
    if (query.teacherIdentificationNumber) where.teacherIdentificationNumber = query.teacherIdentificationNumber;

    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async createStaffFromRecruitment(payload: CreateStaffFromRecruitmentPayload): Promise<Staff> {
    const tenantDomain = payload.tenantDomain
      ? payload.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const staff = await this.repo.save(
      this.repo.create({
        personalIdPart1: payload.part1,
        personalIdPart2: payload.part2,
        personalIdPart3: payload.part3,
        personalIdPart4: payload.part4,
        teacherIdentificationNumber: payload.tinNumber,
        nameInFull: `Teacher ${payload.businessReference}`,
        presentCategory: 'Confirmed',
        designation: 'Teacher',
        homeAddress: null,
        nicNumber: '199012345678',
        religion: 'Buddhism',
        telephoneNumbers: '0770000000',
        email: null,
        dateOfBirth: null,
        dateOfFirstAppointment: null,
        presentService: 'Teaching',
        retirementDate: null,
        gmsInterviewAndConfirmationLetter: null,
        confirmationEffectiveFrom: null,
        noConfirmationLetter: false,
        fixedTermContract006: false,
        temporaryCadre007: false,
        noFile: false,
        resigned: false,
        businessReference: payload.businessReference,
        tenantDomain,
        status: 'ACTIVE',
      }),
    );

    console.log('Staff created from recruitment:', staff.teacherIdentificationNumber);
    return staff;
  }

  async createStaffFromRegistration(payload: CreateStaffFromRegistrationPayload): Promise<Staff> {
    const tenantDomain = payload.tenantDomain
      ? payload.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const staff = await this.repo.save(
      this.repo.create({
        // No TIN in Chandananda flow — use placeholder values
        personalIdPart1: 0,
        personalIdPart2: 0,
        personalIdPart3: 0,
        personalIdPart4: 0,
        teacherIdentificationNumber: `REG-${payload.businessReference}`,
        nameInFull: payload.nameInFull ?? `Teacher ${payload.businessReference}`,
        presentCategory: 'Contract',
        designation: 'Teacher',
        homeAddress: null,
        nicNumber: payload.nicNumber ?? null,
        religion: null,
        telephoneNumbers: null,
        email: null,
        dateOfBirth: null,
        dateOfFirstAppointment: null,
        presentService: 'Teaching',
        retirementDate: null,
        gmsInterviewAndConfirmationLetter: null,
        confirmationEffectiveFrom: null,
        noConfirmationLetter: true,
        fixedTermContract006: false,
        temporaryCadre007: false,
        noFile: false,
        resigned: false,
        businessReference: payload.businessReference,
        tenantDomain,
        status: 'ACTIVE',
      }),
    );

    console.log('Chandananda teacher registered:', staff.teacherIdentificationNumber);
    return staff;
  }
}
