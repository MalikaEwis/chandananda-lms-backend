import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { School } from './entities/school.entity';
import { Student } from './entities/student.entity';
import { Staff } from './entities/staff.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, School, Student, Staff])],
  controllers: [UsersController, SchoolsController, StudentsController, StaffController],
  providers: [UsersService, SchoolsService, StudentsService, StaffService],
})
export class UsersModule {}
