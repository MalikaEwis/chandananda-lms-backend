import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ClaimTaskDto {
  @IsInt()
  @Min(1)
  taskId: number;

  @IsInt()
  @Min(1)
  claimantUserId: number;

  @IsString()
  @IsOptional()
  tenantDomain?: string;
}
