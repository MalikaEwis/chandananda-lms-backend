import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type UserRole =
  | 'ADMIN'
  | 'PRINCIPAL'
  | 'TEACHER'
  | 'PARENT'
  | 'STUDENT'
  | 'STAFF';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 190 })
  email: string;

  @Column({ length: 80 })
  firstName: string;

  @Column({ length: 80 })
  lastName: string;

  @Column({ type: 'varchar', length: 20 })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;
}
