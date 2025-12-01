import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 캠페인 응답 DTO
 */
export class CampaignResponseDto {
  @ApiProperty({ description: '캠페인 ID' })
  id: number;

  @ApiPropertyOptional({ description: '스케줄 ID' })
  scheduleId?: number;

  @ApiProperty({ description: '캠페인 고유 키' })
  campaignKey: string;

  @ApiProperty({ description: '캠페인 타입 (MANUAL, SCHEDULED, RECURRING)' })
  campaignType: string;

  @ApiProperty({ description: '제목' })
  title: string;

  @ApiProperty({ description: '본문' })
  body: string;

  @ApiPropertyOptional({ description: '이미지 URL' })
  imageUrl?: string;

  @ApiPropertyOptional({ description: '추가 데이터' })
  data?: any;

  @ApiProperty({ description: '푸시 타입' })
  type: string;

  @ApiProperty({ description: '카테고리' })
  category: string;

  @ApiProperty({ description: '상태 (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)' })
  status: string;

  @ApiProperty({ description: '목표 발송 수' })
  targetCount: number;

  @ApiProperty({ description: '실제 발송 성공 수' })
  sentCount: number;

  @ApiProperty({ description: '실패 수' })
  failCount: number;

  @ApiPropertyOptional({ description: '예약 발송 시간' })
  scheduledAt?: string;

  @ApiPropertyOptional({ description: '발송 시작 시간' })
  startedAt?: string;

  @ApiPropertyOptional({ description: '발송 완료 시간' })
  completedAt?: string;

  @ApiPropertyOptional({ description: '취소 시간' })
  cancelledAt?: string;

  @ApiPropertyOptional({ description: '취소 사유' })
  cancelReason?: string;

  @ApiPropertyOptional({ description: '에러 메시지' })
  errorMessage?: string;

  @ApiProperty({ description: '생성일시' })
  createdAt: string;

  @ApiPropertyOptional({ description: '생성한 관리자 ID' })
  createdBy?: number;
}

/**
 * 캠페인 목록 응답 DTO
 */
export class CampaignListResponseDto {
  @ApiProperty({ description: '캠페인 목록', type: [CampaignResponseDto] })
  campaigns: CampaignResponseDto[];

  @ApiProperty({ description: '전체 개수' })
  total: number;

  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수' })
  limit: number;

  @ApiProperty({ description: '전체 페이지 수' })
  totalPages: number;
}
