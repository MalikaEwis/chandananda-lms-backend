import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CompleteTaskDto {
  @IsInt()
  @Min(1)
  taskId: number;

  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsInt()
  @Min(1)
  actorUserId: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  tenantDomain?: string;

  @IsString()
  @IsOptional()
  callerRole?: string;
}
