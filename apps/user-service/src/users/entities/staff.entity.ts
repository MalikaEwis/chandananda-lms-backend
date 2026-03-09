import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'staff' })
export class Staff {
  @PrimaryGeneratedColumn()
  id: number;

  // ── TIN parts (Archdiocese format: region/zone/institution/sequential) ────

  @Column({ type: 'int' })
  personalIdPart1: number;

  @Column({ type: 'int' })
  personalIdPart2: number;

  @Column({ type: 'int' })
  personalIdPart3: number;

  @Column({ type: 'int' })
  personalIdPart4: number;

  /** Full formatted TIN: e.g. "1/051/001/0001" */
  @Column({ type: 'varchar', length: 30 })
  teacherIdentificationNumber: string;

  // ── Core profile ──────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 255 })
  nameInFull: string;

  @Column({ type: 'varchar', length: 50, default: 'Confirmed' })
  presentCategory: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  designation: string | null;

  @Column({ type: 'text', nullable: true })
  homeAddress: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  nicNumber: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  religion: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  telephoneNumbers: string | null;

  @Column({ type: 'varchar', length: 190, nullable: true })
  email: string | null;

  // ── Service dates ─────────────────────────────────────────────────────────

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'date', nullable: true })
  dateOfFirstAppointment: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  presentService: string | null;

  @Column({ type: 'date', nullable: true })
  retirementDate: Date | null;

  // ── Confirmation / contract flags ─────────────────────────────────────────

  @Column({ type: 'varchar', length: 255, nullable: true })
  gmsInterviewAndConfirmationLetter: string | null;

  @Column({ type: 'date', nullable: true })
  confirmationEffectiveFrom: Date | null;

  @Column({ default: false })
  noConfirmationLetter: boolean;

  @Column({ default: false })
  fixedTermContract006: boolean;

  @Column({ default: false })
  temporaryCadre007: boolean;

  @Column({ default: false })
  noFile: boolean;

  @Column({ default: false })
  resigned: boolean;

  // ── Workflow linkage ──────────────────────────────────────────────────────

  /** Mirrors the workflow businessReference (e.g. TR-001) */
  @Column({ type: 'varchar', length: 255 })
  businessReference: string;

  @Column({ type: 'varchar', length: 100, default: 'cc.lk' })
  tenantDomain: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
