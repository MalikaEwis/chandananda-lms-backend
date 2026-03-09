import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from './attendance/entities/attendance-record.entity';
import { AttendanceModule } from './attendance/attendance.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3310', 10),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || 'root',
      database: process.env.DB_NAME || 'attendance_db',
      entities: [AttendanceRecord],
      synchronize: true,
    }),
    AttendanceModule,
  ],
})
export class AppModule {}
