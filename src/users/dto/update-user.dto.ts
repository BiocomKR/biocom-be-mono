import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';

/**
 * 사용자 수정 DTO
 * 이름, 휴대폰 번호 수정
 */
export class UpdateUserDto {
  /**
   * 이름 (선택사항)
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
}