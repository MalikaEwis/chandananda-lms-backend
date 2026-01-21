import { IsEmail, IsInt, IsString, MinLength } from 'class-validator';

export class RegisterAuthDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsInt()
  userId: number;
}
