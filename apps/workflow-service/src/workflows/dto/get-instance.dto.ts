import { IsOptional, IsString, MinLength } from 'class-validator';

export class GetInstanceDto {
  @IsString()
  @MinLength(1)
  businessReference: string;

  @IsString()
  @IsOptional()
  tenantDomain?: string;

  @IsString()
  @IsOptional()
  templateCode?: string;
}
