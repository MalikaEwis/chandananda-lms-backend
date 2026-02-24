import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AssignTaskDto {
  @IsInt()
  @Min(1)
  taskId: number;

  @IsInt()
  @Min(1)
  assignToUserId: number;

  @IsInt()
  @Min(1)
  assignedByUserId: number;

  @IsString()
  @IsOptional()
  tenantDomain?: string;
}
