import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, MinLength, MaxLength, Matches, IsInt, Min } from 'class-validator';

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
   * 이름 (선택사항)
   * 사용자 실명
   */
  @ApiProperty({
    description: '사용자 이름',
    example: '김철수',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: '이름은 문자열이어야 합니다.' })
  @MaxLength(50, { message: '이름은 최대 50자까지 입력 가능합니다.' })
  name?: string;

  /**
   * 휴대폰 번호 (선택사항)
   */
  @ApiProperty({
    description: '휴대폰 번호',
    example: '01087654321',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '휴대폰 번호는 문자열이어야 합니다.' })
  @Matches(/^01[0-9]{8,9}$/, { message: '올바른 휴대폰 번호 형식이 아닙니다.' })
  mobile?: string;

  /**
   * AI 페르소나 ID (선택사항)
   * 사용자의 AI 캐릭터 선택
   */
  @ApiProperty({
    description: 'AI 페르소나 ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: '페르소나 ID는 정수여야 합니다.' })
  @Min(1, { message: '페르소나 ID는 1 이상이어야 합니다.' })
  characterId?: number;
}