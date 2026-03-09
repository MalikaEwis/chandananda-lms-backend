import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class RejectTaskDto {
  @IsInt()
  @Min(1)
  taskId: number;

  @IsInt()
  @Min(1)
  actorUserId: number;

  /** Required rejection reason — stored in task.comments */
  @IsString()
  @MinLength(1)
  reason: string;

  @IsString()
  @IsOptional()
  tenantDomain?: string;

  @IsString()
  @IsOptional()
  callerRole?: string;
}
