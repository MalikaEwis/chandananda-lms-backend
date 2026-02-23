import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { School } from './entities/school.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @InjectRepository(School) private schoolRepo: Repository<School>,
  ) {}

  async create(dto: CreateUserDto) {
    const tenantDomain = dto.tenantDomain
      ? dto.tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    const exists = await this.repo.findOne({
      where: { email: dto.email, tenantDomain },
    });
    if (exists)
      throw new BadRequestException('Email already exists in this tenant');

    const user = await this.repo.save({
      email: dto.email,
      tenantDomain,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role as any,
    });

    return user;
  }

  async findById(id: number) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string, tenantDomain: string) {
    const user = await this.repo.findOne({
      where: { email, tenantDomain },
    });
    return user ?? null;
  }

  async updateStatus(userId: number, status: 'ACTIVE' | 'INACTIVE') {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.status = status;
    return this.repo.save(user);
  }

  async assignSchool(
    userId: number,
    schoolId: number,
    tenantDomain: string,
  ) {
    const normalizedTenant = tenantDomain
      ? tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    // Load user by (id, tenantDomain) with schools relation
    const user = await this.repo.findOne({
      where: { id: userId, tenantDomain: normalizedTenant },
      relations: ['schools'],
    });

    if (!user) {
      throw new RpcException({
        statusCode: 404,
        message: 'User not found',
        error: 'Not Found',
      });
    }

    // Load school by (id, tenantDomain)
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId, tenantDomain: normalizedTenant },
    });

    if (!school) {
      throw new RpcException({
        statusCode: 404,
        message: 'School not found',
        error: 'Not Found',
      });
    }

    // Check if user is already assigned to this school
    const alreadyAssigned = user.schools.some((s) => s.id === school.id);

    if (!alreadyAssigned) {
      user.schools.push(school);
      await this.repo.save(user);
    }

    return { message: 'User assigned to school successfully' };
  }

  async getMySchools(userId: number, tenantDomain?: string) {
    const normalizedTenant = tenantDomain
      ? tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    // Load user by (id, tenantDomain) with schools relation
    const user = await this.repo.findOne({
      where: { id: userId, tenantDomain: normalizedTenant },
      relations: ['schools'],
    });

    if (!user) {
      throw new RpcException({
        statusCode: 404,
        message: 'User not found',
        error: 'Not Found',
      });
    }

    return user.schools;
  }

  async listUsersBySchool(schoolId: number, tenantDomain?: string) {
    const normalizedTenant = tenantDomain
      ? tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    // Verify school exists in tenant
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId, tenantDomain: normalizedTenant },
    });

    if (!school) {
      throw new RpcException({
        statusCode: 404,
        message: 'School not found',
        error: 'Not Found',
      });
    }

    // Query users assigned to this school within the same tenant
    const users = await this.repo
      .createQueryBuilder('user')
      .innerJoin('user.schools', 'school')
      .where('school.id = :schoolId', { schoolId })
      .andWhere('user.tenantDomain = :tenantDomain', {
        tenantDomain: normalizedTenant,
      })
      .orderBy('user.createdAt', 'DESC')
      .getMany();

    return users;
  }

  async listUsers(tenantDomain?: string, schoolId?: number) {
    const normalizedTenant = tenantDomain
      ? tenantDomain.trim().toLowerCase()
      : 'cc.lk';

    if (!schoolId) {
      // Return all users in tenant
      const users = await this.repo.find({
        where: { tenantDomain: normalizedTenant },
        order: { createdAt: 'DESC' },
      });
      return users;
    }

    // If schoolId is provided, verify school exists and return users assigned to it
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId, tenantDomain: normalizedTenant },
    });

    if (!school) {
      throw new RpcException({
        statusCode: 404,
        message: 'School not found',
        error: 'Not Found',
      });
    }

    // Query users assigned to this school within the same tenant
    const users = await this.repo
      .createQueryBuilder('user')
      .innerJoin('user.schools', 'school')
      .where('school.id = :schoolId', { schoolId })
      .andWhere('user.tenantDomain = :tenantDomain', {
        tenantDomain: normalizedTenant,
      })
      .orderBy('user.createdAt', 'DESC')
      .getMany();

    return users;
  }
}
