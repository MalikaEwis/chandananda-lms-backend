import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskStatus } from '../enums';
import { WorkflowInstance } from './workflow-instance.entity';
import { WorkflowStep } from './workflow-step.entity';

@Entity({ name: 'workflow_tasks' })
export class WorkflowTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  instanceId: number;

  @ManyToOne(() => WorkflowInstance, (instance) => instance.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'instanceId' })
  instance: WorkflowInstance;

  @Column()
  stepId: number;

  @ManyToOne(() => WorkflowStep, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stepId' })
  step: WorkflowStep;

  @Column({ type: 'int', nullable: true })
  assignedToUserId: number | null;

  @Column({ type: 'int', nullable: true })
  assignedByUserId: number | null;

  @Column({ type: 'datetime', nullable: true })
  assignedAt: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  taskType: string | null;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.PENDING })
  status: TaskStatus;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'int', nullable: true })
  actedByUserId: number | null;

  @Column({ type: 'datetime', nullable: true })
  actedAt: Date | null;

  // Stored as JSON string; parse on read, stringify on write
  @Column({ type: 'text', nullable: true })
  payloadJson: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
