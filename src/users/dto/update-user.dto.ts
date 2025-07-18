import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

/**
 * 사용자 수정 DTO
 * 기존 사용자 정보 수정 시 필요한 데이터
 * 모든 필드가 선택사항 (부분 업데이트 지원)
 */
export class UpdateUserDto {
  /**
   * 이메일 주소 (선택사항)
   * 변경 시 중복 확인 수행
   */
  @ApiProperty({
    description: '사용자 이메일 주소',
    example: 'newemail@example.com',
    format: 'email',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email?: string;

  /**
   * 비밀번호 (선택사항)
   * 최소 8자 이상의 보안 비밀번호
   */
  @ApiProperty({
    description: '새로운 비밀번호 (최소 8자)',
    example: 'newpassword123',
    minLength: 8,
    format: 'password',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password?: string;

  /**
   * 닉네임 (선택사항)
   * 사용자 표시명으로 사용
   */
  @ApiProperty({
    description: '사용자 닉네임',
    example: 'newcooluser123',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: '닉네임은 문자열이어야 합니다.' })
  @MaxLength(50, { message: '닉네임은 최대 50자까지 입력 가능합니다.' })
  nickname?: string;
}