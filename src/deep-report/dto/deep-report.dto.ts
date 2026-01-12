import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 심층리포트 목록 아이템 DTO
 */
export class DeepReportListItemDto {
  @ApiProperty({ description: '리포트 ID (DB PK)', example: 1 })
  id: number;

  @ApiProperty({ description: '제목 (N주차 심층 리포트)', example: '3주차 심층 리포트' })
  title: string;

  @ApiProperty({ description: '읽음 여부', example: false })
  isRead: boolean;

  @ApiProperty({ description: '생성일 (YYYY.MM.DD)', example: '2026.01.12' })
  createdAt: string;
}

/**
 * 심층리포트 목록 응답 DTO
 */
export class DeepReportListResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '심층리포트 목록', type: [DeepReportListItemDto] })
  data: DeepReportListItemDto[];
}

/**
 * 심층리포트 콘텐츠 DTO
 */
export class DeepReportContentDto {
  @ApiProperty({ description: '리포트 ID', example: 'report_abc123' })
  reportId: string;

  @ApiProperty({ description: '제공자', example: 'openai' })
  provider: string;

  @ApiProperty({ description: '리포트 콘텐츠 (JSON)' })
  content: any;

  @ApiProperty({ description: '시작일', example: '2025-12-16' })
  startDate: string;

  @ApiProperty({ description: '종료일', example: '2025-12-22' })
  endDate: string;

  @ApiPropertyOptional({ description: '주차 번호', example: 1 })
  weekNumber?: number;

  @ApiProperty({ description: '생성일시', example: '2025-12-23T10:00:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({ description: '이번 조회로 지급된 포인트 (이미 지급받았으면 0)', example: 300 })
  pointsEarned?: number;
}

/**
 * 심층리포트 응답 DTO
 */
export class DeepReportResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiPropertyOptional({ description: '심층리포트 데이터 (없으면 null)', type: DeepReportContentDto })
  data: DeepReportContentDto | null;
}
