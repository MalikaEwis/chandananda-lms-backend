import {
  IsEmail,
  IsInt,
  IsString,
  MinLength,
  IsOptional,
} from 'class-validator';

export class RegisterAuthDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsInt()
  userId: number;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  tenantDomain?: string;
}
