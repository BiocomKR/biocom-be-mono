import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 푸시 로그 응답 DTO
 */
export class PushLogResponseDto {
  @ApiProperty({ description: '로그 ID' })
  id: number;

  @ApiPropertyOptional({ description: '캠페인 ID' })
  campaignId?: number;

  @ApiProperty({ description: '유저 ID' })
  userId: number;

  @ApiPropertyOptional({ description: '푸시 토큰 ID' })
  pushTokenId?: number;

  @ApiProperty({ description: '제목' })
  title: string;

  @ApiProperty({ description: '본문' })
  body: string;

  @ApiProperty({ description: '푸시 타입' })
  type: string;

  @ApiPropertyOptional({ description: '추가 데이터' })
  data?: any;

  @ApiProperty({ description: '발송 성공 여부' })
  success: boolean;

  @ApiPropertyOptional({ description: '에러 코드' })
  errorCode?: string;

  @ApiPropertyOptional({ description: '에러 메시지' })
  errorMessage?: string;

  @ApiProperty({ description: '발송 시각' })
  sentAt: Date;

  @ApiPropertyOptional({ description: '읽은 시각' })
  readAt?: Date | null;

  @ApiPropertyOptional({ description: '클릭한 시각' })
  clickedAt?: Date | null;
}

/**
 * 푸시 로그 목록 응답 DTO (페이지네이션 포함)
 */
export class PushLogListResponseDto {
  @ApiProperty({ description: '로그 목록', type: [PushLogResponseDto] })
  logs: PushLogResponseDto[];

  @ApiProperty({ description: '전체 로그 수' })
  total: number;

  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수' })
  limit: number;

  @ApiProperty({ description: '전체 페이지 수' })
  totalPages: number;
}
