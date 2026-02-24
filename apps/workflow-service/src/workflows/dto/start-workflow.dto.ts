import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class StartWorkflowDto {
  @IsString()
  @MinLength(1)
  templateCode: string;

  @IsString()
  @MinLength(1)
  businessReference: string;

  @IsInt()
  @Min(1)
  startedByUserId: number;

  @IsInt()
  @IsOptional()
  schoolId?: number;

  @IsString()
  @IsOptional()
  tenantDomain?: string;
}
