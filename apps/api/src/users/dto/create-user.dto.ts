import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * 사용자 생성 DTO
 * 새로운 사용자 등록 시 필요한 데이터
 */
export class CreateUserDto {
  /**
   * 이메일 주소
   * 로그인 ID로 사용되며, 유니크해야 함
   */
  @ApiProperty({
    description: '사용자 이메일 주소 (로그인 ID)',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  /**
   * 비밀번호
   * 최소 8자 이상의 보안 비밀번호
   */
  @ApiProperty({
    description: '사용자 비밀번호 (최소 8자)',
    example: 'password123',
    minLength: 8,
    format: 'password',
  })
  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password: string;

  /**
   * 이름
   * 사용자 실명
   */
  @ApiProperty({
    description: '사용자 이름',
    example: '홍길동',
    maxLength: 50,
  })
  @IsString({ message: '이름은 문자열이어야 합니다.' })
  @MaxLength(50, { message: '이름은 최대 50자까지 입력 가능합니다.' })
  name: string;

  /**
   * 휴대폰 번호
   * 하이픈 없이 숫자만 입력
   */
  @ApiProperty({
    description: '휴대폰 번호 (하이픈 없이)',
    example: '01012345678',
    pattern: '^01[0-9]{8,9}$',
  })
  @IsString({ message: '휴대폰 번호는 문자열이어야 합니다.' })
  @Matches(/^01[0-9]{8,9}$/, { message: '올바른 휴대폰 번호 형식이 아닙니다.' })
  mobile: string;
}