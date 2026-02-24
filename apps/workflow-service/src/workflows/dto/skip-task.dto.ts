import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SkipTaskDto {
  @IsInt()
  @Min(1)
  taskId: number;

  @IsInt()
  @Min(1)
  actorUserId: number;

  @IsString()
  @IsOptional()
  tenantDomain?: string;
}
