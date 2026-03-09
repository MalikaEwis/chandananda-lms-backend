import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Index('idx_attendance_student_date', ['tenantDomain', 'studentId', 'date'], { unique: true })
@Index('idx_attendance_staff_date', ['tenantDomain', 'staffId', 'date'], { unique: true })
@Entity({ name: 'attendance_records' })
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  tenantDomain: string;

  /** UUID from user-service Student — exactly one of studentId or staffId must be set */
  @Column({ type: 'varchar', length: 255, nullable: true })
  studentId: string | null;

  /** UUID from user-service Staff — exactly one of studentId or staffId must be set */
  @Column({ type: 'varchar', length: 255, nullable: true })
  staffId: string | null;

  /** Date of attendance: stored as MySQL DATE (YYYY-MM-DD) */
  @Column({ type: 'date' })
  date: Date;

  @Column({
    type: 'enum',
    enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
    default: 'ABSENT',
  })
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

  /** User ID of whoever marked this attendance */
  @Column({ type: 'varchar', length: 255 })
  markedByUserId: string;

  @Column({ type: 'datetime' })
  markedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
