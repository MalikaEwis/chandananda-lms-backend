import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'students' })
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  /** Generated on admission: ADM-<6-digit timestamp suffix> */
  @Column({ length: 20 })
  admissionNo: string;

  /** Mirrors the workflow businessReference (e.g. APP-007) */
  @Column({ length: 255 })
  businessReference: string;

  @Column({ length: 100, default: 'cc.lk' })
  tenantDomain: string;

  @Column({ type: 'varchar', length: 10, default: 'PENDING' })
  status: 'PENDING' | 'ACTIVE';

  @CreateDateColumn()
  createdAt: Date;
}
