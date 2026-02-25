import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CancelWorkflowDto {
  @IsString()
  businessReference: string;

  @IsString()
  templateCode: string;

  @IsInt()
  @Min(1)
  actorUserId: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  tenantDomain?: string;
}
