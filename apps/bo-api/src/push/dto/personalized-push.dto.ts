import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsNumber,
  IsIn,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 세그먼트 조건 DTO
 */
export class SegmentConditionDto {
  @ApiProperty({ description: '조건 키', example: 'lastOrderAt' })
  @IsString()
  key: string;

  @ApiProperty({ description: '연산자', example: 'days_ago_gte' })
  @IsString()
  operator: string;

  @ApiPropertyOptional({ description: '비교값', example: 7 })
  @IsOptional()
  value?: any;
}

/**
 * 세그먼트 규칙 DTO
 */
export class SegmentRuleDto {
  @ApiProperty({ description: '논리 연산자', enum: ['AND', 'OR'], example: 'AND' })
  @IsIn(['AND', 'OR'])
  logic: 'AND' | 'OR';

  @ApiProperty({ description: '조건 목록', type: [SegmentConditionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentConditionDto)
  @ArrayMinSize(1)
  conditions: SegmentConditionDto[];
}

/**
 * 세그먼트 미리보기 요청 DTO
 */
export class SegmentPreviewDto {
  @ApiProperty({ description: '세그먼트 규칙', type: SegmentRuleDto })
  @ValidateNested()
  @Type(() => SegmentRuleDto)
  segmentRule: SegmentRuleDto;
}

/**
 * 템플릿 미리보기 요청 DTO
 */
export class TemplatePreviewDto {
  @ApiProperty({ description: '제목 템플릿', example: '{{customerAnimal}} 유형 완벽 정복' })
  @IsString()
  title: string;

  @ApiProperty({ description: '본문 템플릿', example: '{{customerName}}님, 솔루션을 가져왔어요!' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: '샘플 사용자 ID' })
  @IsOptional()
  @IsNumber()
  sampleUserId?: number;
}

/**
 * 개인화 푸시 발송 요청 DTO
 */
export class SendPersonalizedPushDto {
  @ApiProperty({ description: '제목 템플릿', example: '{{customerAnimal}} 유형 완벽 정복' })
  @IsString()
  title: string;

  @ApiProperty({ description: '본문 템플릿', example: '{{customerName}}님, 솔루션을 가져왔어요!' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: '이미지 URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: '추가 데이터 (JSON)' })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;

  @ApiProperty({ description: '세그먼트 규칙', type: SegmentRuleDto })
  @ValidateNested()
  @Type(() => SegmentRuleDto)
  segmentRule: SegmentRuleDto;

  @ApiPropertyOptional({ description: '테스트 발송 여부', default: false })
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;
}
