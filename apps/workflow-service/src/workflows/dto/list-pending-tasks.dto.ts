import { IsInt, IsOptional, IsString } from 'class-validator';

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
}
