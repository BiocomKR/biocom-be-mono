import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, IsArray, IsInt } from 'class-validator';

export class CreateIssueReportDto {
  @ApiProperty({ description: '신고 내용', example: '홈 화면에서 앱이 종료됩니다.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional({ description: '첨부파일 ID 배열', example: [1, 2], type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  fileIds?: number[];

  @ApiPropertyOptional({ description: '앱 버전', example: '1.0.0' })
  @IsString()
  @IsOptional()
  appVersion?: string;

  @ApiPropertyOptional({ description: '디바이스 정보', example: 'iPhone 15 Pro, iOS 17.2' })
  @IsString()
  @IsOptional()
  deviceInfo?: string;
}
