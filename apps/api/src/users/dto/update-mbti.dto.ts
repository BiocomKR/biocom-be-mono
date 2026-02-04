import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

/**
 * MBTI 업데이트 DTO
 * 사용자의 MBTI만 업데이트하는 전용 DTO
 */
export class UpdateMbtiDto {
  /**
   * MBTI 유형 (필수)
   * 16가지 MBTI 유형 중 하나
   */
  @ApiProperty({
    description: 'MBTI 유형',
    example: 'INTJ',
    required: true,
  })
  @IsString({ message: 'MBTI는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: 'MBTI는 필수 입력값입니다.' })
  @Length(4, 4, { message: 'MBTI는 4자리여야 합니다.' })
  @Matches(/^[EI][SN][TF][JP]$/i, {
    message: 'MBTI 형식이 올바르지 않습니다. (예: INTJ, ENFP)',
  })
  mbti: string;
}
