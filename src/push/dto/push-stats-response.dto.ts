import { ApiProperty } from '@nestjs/swagger';

/**
 * 푸시 통계 응답 DTO
 *
 * 대시보드용 집계 데이터
 */
export class PushStatsResponseDto {
  @ApiProperty({
    description: '총 발송 건수',
    example: 1234,
  })
  totalSent: number;

  @ApiProperty({
    description: '성공 건수',
    example: 1100,
  })
  successCount: number;

  @ApiProperty({
    description: '실패 건수',
    example: 134,
  })
  failureCount: number;

  @ApiProperty({
    description: '읽음 건수',
    example: 800,
  })
  readCount: number;

  @ApiProperty({
    description: '클릭 건수',
    example: 500,
  })
  clickedCount: number;

  @ApiProperty({
    description: '타입별 통계',
    example: {
      SYSTEM: 100,
      REMIND: 200,
      MARKETING: 50,
      TRANSACTIONAL: 30,
      ETC: 20,
    },
  })
  byType: Record<string, number>;
}
