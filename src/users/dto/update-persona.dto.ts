import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * AI 페르소나 업데이트 DTO
 * 사용자의 AI 페르소나 식별자만 업데이트하는 전용 DTO
 */
export class UpdatePersonaDto {
  /**
   * AI 페르소나 ID (필수)
   * 사용자의 AI 캐릭터 선택
   */
  @ApiProperty({
    description: 'AI 페르소나 ID',
    example: 1,
    required: true,
  })
  @IsInt({ message: '페르소나 ID는 정수여야 합니다.' })
  @Min(1, { message: '페르소나 ID는 1 이상이어야 합니다.' })
  aiPersonaId: number;
}
