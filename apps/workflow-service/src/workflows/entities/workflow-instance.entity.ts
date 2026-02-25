import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkflowStatus } from '../enums';
import { WorkflowTemplate } from './workflow-template.entity';
import { WorkflowTask } from './workflow-task.entity';

@Entity({ name: 'workflow_instances' })
@Index(['tenantDomain', 'templateId', 'businessReference'], { unique: true })
export class WorkflowInstance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  templateId: number;

  @ManyToOne(() => WorkflowTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'templateId' })
  template: WorkflowTemplate;

  @Column({ length: 255 })
  businessReference: string;

  @Column({ length: 100, default: 'cc.lk' })
  tenantDomain: string;

  @Column({ type: 'int', nullable: true })
  schoolId: number | null;

  @Column({ type: 'enum', enum: WorkflowStatus, default: WorkflowStatus.DRAFT })
  status: WorkflowStatus;

  @Column({ default: 1 })
  currentStepOrder: number;

  @Column({ type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => WorkflowTask, (task) => task.instance, { eager: false })
  tasks: WorkflowTask[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeTenantDomain() {
    if (this.tenantDomain) {
      this.tenantDomain = this.tenantDomain.trim().toLowerCase();
    }
  }
}
