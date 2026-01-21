import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsIn(['ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT', 'STUDENT', 'STAFF'])
  role: string;
}
