import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity({ name: 'schools' })
@Index(['code', 'tenantDomain'], { unique: true })
export class School {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  code: string;

  @Column({ length: 100, default: 'cc.lk' })
  tenantDomain: string;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeTenantDomain() {
    if (this.tenantDomain) {
      this.tenantDomain = this.tenantDomain.trim().toLowerCase();
    }
  }
}
