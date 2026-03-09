import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListPendingTasksDto {
  @IsString()
  @IsOptional()
  tenantDomain?: string;

  @IsInt()
  @IsOptional()
  schoolId?: number;

  @IsInt()
  @IsOptional()
  assignedToUserId?: number;

  @IsString()
  @IsOptional()
  requiredRole?: string;

  @IsString()
  @IsOptional()
  templateCode?: string;

  @IsString()
  @IsOptional()
  module?: string;

  /** Filter to a specific workflow instance */
  @IsInt()
  @Min(1)
  @IsOptional()
  instanceId?: number;

  /** Filter by business reference (e.g. APP-007) */
  @IsString()
  @IsOptional()
  businessReference?: string;
}
