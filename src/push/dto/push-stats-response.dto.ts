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
}
