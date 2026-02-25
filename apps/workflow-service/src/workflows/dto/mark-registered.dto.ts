import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MarkRegisteredDto {
  @IsString()
  businessReference: string;

  @IsString()
  templateCode: string;

  @IsInt()
  @Min(1)
  actorUserId: number;

  @IsString()
  @IsOptional()
  tenantDomain?: string;
}
