import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { School } from './entities/school.entity';
import { CreateSchoolDto } from './dto/create-school.dto';

@Injectable()
export class SchoolsService {
  constructor(@InjectRepository(School) private repo: Repository<School>) {}

  async create(dto: CreateSchoolDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const exists = await this.repo.findOne({
      where: { code: dto.code, tenantDomain },
    });

    if (exists) {
      throw new RpcException({
        statusCode: 409,
        message: 'School code already exists in this tenant',
        error: 'Conflict',
      });
    }

    const school = await this.repo.save({
      name: dto.name,
      code: dto.code,
      tenantDomain,
    });

    return school;
  }

  async list(tenantDomain?: string) {
    const normalizedTenant = tenantDomain
      ? tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const schools = await this.repo.find({
      where: { tenantDomain: normalizedTenant },
      order: { createdAt: 'DESC' },
    });

    return schools;
  }

  async getById(id: number, tenantDomain?: string) {
    const normalizedTenant = tenantDomain
      ? tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const school = await this.repo.findOne({
      where: { id, tenantDomain: normalizedTenant },
    });

    if (!school) {
      throw new RpcException({
        statusCode: 404,
        message: 'School not found',
        error: 'Not Found',
      });
    }

    return school;
  }
}
