import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

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
   * 닉네임 (선택사항)
   * 사용자 표시명으로 사용
   */
  @ApiProperty({
    description: '사용자 닉네임 (선택사항)',
    example: 'cooluser123',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: '닉네임은 문자열이어야 합니다.' })
  @MaxLength(50, { message: '닉네임은 최대 50자까지 입력 가능합니다.' })
  nickname?: string;
}