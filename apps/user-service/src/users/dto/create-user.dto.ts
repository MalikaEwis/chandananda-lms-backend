import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsIn(['ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT', 'STUDENT', 'STAFF'])
  role: string;
}
