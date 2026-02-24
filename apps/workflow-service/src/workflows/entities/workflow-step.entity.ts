import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StepType } from '../enums';
import { WorkflowTemplate } from './workflow-template.entity';

@Entity({ name: 'workflow_steps' })
@Index(['templateId', 'stepOrder'], { unique: true })
export class WorkflowStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  templateId: number;

  @ManyToOne(() => WorkflowTemplate, (template) => template.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template: WorkflowTemplate;

  @Column({ length: 255 })
  stepName: string;

  @Column()
  stepOrder: number;

  @Column({ type: 'enum', enum: StepType })
  stepType: StepType;

  @Column({ default: false })
  isOptional: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  requiredRole: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
