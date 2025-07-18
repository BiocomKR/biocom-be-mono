import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * 회원가입 DTO
 * 회원가입 시 필요한 정보를 정의
 */
export class SignUpDto {
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
   * 최소 8자, 영문, 숫자, 특수문자 포함
   */
  @ApiProperty({
    description: '비밀번호 (최소 8자, 영문/숫자/특수문자 포함)',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  @MaxLength(20, { message: '비밀번호는 20자 이하여야 합니다.' })
  @Matches(
    /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
    { message: '비밀번호는 영문, 숫자, 특수문자를 포함해야 합니다.' }
  )
  password: string;

  /**
   * 닉네임
   */
  @ApiProperty({
    description: '사용자 닉네임',
    example: '홍길동',
    required: false,
  })
  @IsString()
  @MinLength(2, { message: '닉네임은 최소 2자 이상이어야 합니다.' })
  @MaxLength(20, { message: '닉네임은 20자 이하여야 합니다.' })
  nickname?: string;
}