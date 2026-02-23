import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { School } from './entities/school.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, School])],
  controllers: [UsersController, SchoolsController],
  providers: [UsersService, SchoolsService],
})
export class UsersModule {}
