import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { School } from './entities/school.entity';
import { Student } from './entities/student.entity';
import { Staff } from './entities/staff.entity';
import { Guardian } from './entities/guardian.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, School, Student, Staff, Guardian])],
  controllers: [UsersController, SchoolsController, StudentsController, StaffController, GuardiansController],
  providers: [UsersService, SchoolsService, StudentsService, StaffService, GuardiansService],
})
export class UsersModule {}
