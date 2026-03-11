import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersController } from './users/users.controller';
import { SchoolsController } from './schools/schools.controller';
import { WorkflowsController } from './workflows/workflows.controller';
import { StudentsController } from './students/students.controller';
import { StaffController } from './staff/staff.controller';
import { AttendanceController } from './attendance/attendance.controller';
import { ParentController } from './parent/parent.controller';
import { GuardiansController } from './guardians/guardians.controller';
import { MicroservicesModule } from './microservices/microservices.module';
import { TenantMiddleware } from './middleware/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MicroservicesModule,
    AuthModule,
  ],
  controllers: [AppController, UsersController, SchoolsController, WorkflowsController, StudentsController, StaffController, AttendanceController, ParentController, GuardiansController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
