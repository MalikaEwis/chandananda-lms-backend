import { IsInt, IsOptional, IsString } from 'class-validator';

export class AssignSchoolDto {
  @IsInt()
  userId: number;

  @IsInt()
  schoolId: number;

  @IsOptional()
  @IsString()
  tenantDomain?: string;
}
