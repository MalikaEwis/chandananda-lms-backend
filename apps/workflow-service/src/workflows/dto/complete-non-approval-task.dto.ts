import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CompleteNonApprovalTaskDto {
  @IsInt()
  @Min(1)
  taskId: number;

  @IsInt()
  @Min(1)
  actorUserId: number;

  @IsIn(['DONE', 'FAILED'])
  result: 'DONE' | 'FAILED';

  @IsString()
  @IsOptional()
  comment?: string;

  @IsOptional()
  payload?: any;

  @IsString()
  @IsOptional()
  tenantDomain?: string;

  @IsString()
  @IsOptional()
  callerRole?: string;
}
