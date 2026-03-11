import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type GuardianRelationship = 'MOTHER' | 'FATHER' | 'GUARDIAN';

@Index('idx_guardian_parent_student', ['parentUserId', 'studentId'], { unique: true })
@Entity({ name: 'guardians' })
export class Guardian {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK → users.id (the parent's user account) */
  @Column({ type: 'int' })
  parentUserId: number;

  /** FK → students.id */
  @Column({ type: 'int' })
  studentId: number;

  @Column({ type: 'varchar', length: 20, default: 'GUARDIAN' })
  relationship: GuardianRelationship;

  /** True if this is the student's primary contact */
  @Column({ default: false })
  isPrimary: boolean;

  @Column({ length: 100, default: 'cc.lk' })
  tenantDomain: string;

  @CreateDateColumn()
  createdAt: Date;
}
