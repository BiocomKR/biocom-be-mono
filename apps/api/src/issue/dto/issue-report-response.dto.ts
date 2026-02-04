import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileInfoDto {
  @ApiProperty({ description: '파일 ID' })
  id: number;

  @ApiProperty({ description: '파일 URL' })
  url: string;

  @ApiProperty({ description: '원본 파일명' })
  originalName: string;
}

export class IssueReportResponseDto {
  @ApiProperty({ description: '신고 ID' })
  id: number;

  @ApiProperty({ description: '신고 내용' })
  content: string;

  @ApiPropertyOptional({ description: '첨부파일 목록', type: [FileInfoDto] })
  files: FileInfoDto[];

  @ApiPropertyOptional({ description: '관리자 답변' })
  answer: string | null;

  @ApiPropertyOptional({ description: '답변 일시' })
  answeredAt: Date | null;

  @ApiPropertyOptional({ description: '앱 버전' })
  appVersion: string | null;

  @ApiPropertyOptional({ description: '디바이스 정보' })
  deviceInfo: string | null;

  @ApiProperty({ description: '생성일시' })
  createdAt: Date;

  @ApiProperty({ description: '답변 여부' })
  isAnswered: boolean;
}

export class IssueReportListResponseDto {
  @ApiProperty({ type: [IssueReportResponseDto] })
  items: IssueReportResponseDto[];

  @ApiProperty({ description: '전체 개수' })
  total: number;
}
