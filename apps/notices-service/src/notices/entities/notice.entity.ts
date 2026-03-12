import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'notices' })
export class Notice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  tenantDomain: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: ['GENERAL', 'HOMEWORK', 'EVENT', 'EXAM', 'URGENT', 'OTHER'],
    default: 'GENERAL',
  })
  category: string;

  @Column({ type: 'varchar', length: 255 })
  publishedByUserId: string;

  @Column({ type: 'datetime' })
  publishedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'json', nullable: true })
  targetAudience: {
    roles?: string[];
    classes?: string[];
    all?: boolean;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
