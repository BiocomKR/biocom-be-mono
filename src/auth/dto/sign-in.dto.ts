import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

/**
 * 로그인 DTO
 * 로그인 시 필요한 정보를 정의
 */
export class SignInDto {
  /**
   * 이메일 주소
   */
  @ApiProperty({
    description: '사용자 이메일',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  /**
   * 비밀번호
   */
  @ApiProperty({
    description: '비밀번호',
    example: 'Password123!',
  })
  @IsString()
  @IsNotEmpty({ message: '비밀번호를 입력해주세요.' })
  password: string;
}