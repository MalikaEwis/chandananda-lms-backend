import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { School } from './school.entity';

export type UserRole =
  | 'ADMIN'
  | 'PRINCIPAL'
  | 'TEACHER'
  | 'PARENT'
  | 'STUDENT'
  | 'STAFF'
  | 'SECTION_HEAD'
  | 'INTERVIEW_PANEL'
  | 'ARCHDIOCESE_ADMIN'
  | 'PANEL_MEMBER';

@Entity({ name: 'users' })
@Index(['email', 'tenantDomain'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 190 })
  email: string;

  @Column({ length: 100, default: 'cc.lk' })
  tenantDomain: string;

  @Column({ length: 80 })
  firstName: string;

  @Column({ length: 80 })
  lastName: string;

  @Column({ type: 'varchar', length: 20 })
  role: UserRole;

  @Column({ type: 'varchar', length: 10, default: 'ACTIVE' })
  status: 'ACTIVE' | 'INACTIVE';

  @ManyToMany(() => School)
  @JoinTable({
    name: 'user_schools',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'schoolId', referencedColumnName: 'id' },
  })
  schools: School[];

  @CreateDateColumn()
  createdAt: Date;
}
