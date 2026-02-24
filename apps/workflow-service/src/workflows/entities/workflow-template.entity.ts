import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkflowType } from '../enums';
import { WorkflowStep } from './workflow-step.entity';

@Entity({ name: 'workflow_templates' })
@Index(['templateCode', 'tenantDomain'], { unique: true })
export class WorkflowTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  templateCode: string;

  @Column({ type: 'enum', enum: WorkflowType })
  workflowType: WorkflowType;

  @Column({ length: 100, default: 'cc.lk' })
  tenantDomain: string;

  @Column({ type: 'int', nullable: true })
  schoolId: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  module: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => WorkflowStep, (step) => step.template, {
    cascade: true,
    eager: false,
  })
  steps: WorkflowStep[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeTenantDomain() {
    if (this.tenantDomain) {
      this.tenantDomain = this.tenantDomain.trim().toLowerCase();
    }
  }
}
