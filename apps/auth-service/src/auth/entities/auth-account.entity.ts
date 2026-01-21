import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuthStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';

@Entity({ name: 'auth_accounts' })
export class AuthAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 190 })
  email: string;

  // userId belongs to user-service; we store it as reference only
  @Column()
  userId: number;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: AuthStatus;

  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'datetime', nullable: true })
  lockedUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
