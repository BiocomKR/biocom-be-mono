import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  MaxLength,
  IsEnum
} from 'class-validator';

/**
 * 성별 Enum
 */
export enum Gender {
  M = 'M',
  F = 'F'
}

/**
 * AI 페르소나 생성 요청 DTO
 */
export class CreateAiPersonaDto {
  @ApiProperty({ description: '페르소나 이름', example: '철민님', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ description: '페르소나 설명', example: '친근하고 따뜻한 페르소나입니다' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: '페르소나 성격/대화 스타일',
    example: '친근한 말투를 사용하며 "어이구~", "그래그래~" 같은 표현을 즐겨 사용합니다'
  })
  @IsOptional()
  @IsString()
  personality?: string;

  @ApiPropertyOptional({ description: '페르소나 이미지 URL', example: 'https://example.com/persona.png' })
  @IsOptional()
  @IsString()
  personaUrl?: string;

  @ApiPropertyOptional({ description: '정렬 순서', example: 1, default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

/**
 * AI 페르소나 수정 요청 DTO
 */
export class UpdateAiPersonaDto {
  @ApiPropertyOptional({ description: '페르소나 이름', example: '철민님 (수정됨)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ description: '페르소나 설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '페르소나 성격/대화 스타일' })
  @IsOptional()
  @IsString()
  personality?: string;

  @ApiPropertyOptional({ description: '페르소나 이미지 URL' })
  @IsOptional()
  @IsString()
  personaUrl?: string;

  @ApiPropertyOptional({ description: '활성화 여부', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '정렬 순서', example: 2 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

/**
 * AI 페르소나 응답 DTO
 */
export class AiPersonaResponseDto {
  @ApiProperty({ description: '페르소나 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '페르소나 이름', example: '철민님' })
  name: string;

  @ApiPropertyOptional({ description: '페르소나 설명', example: '친근하고 따뜻한 페르소나입니다' })
  description?: string;

  @ApiPropertyOptional({ description: '페르소나 성격/대화 스타일' })
  personality?: string;

  @ApiPropertyOptional({ description: '페르소나 이미지 URL' })
  personaUrl?: string;

  @ApiPropertyOptional({ description: '페르소나 썸네일 이미지 URL', example: 'https://example.com/thumbnail.png' })
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: '페르소나 성별', enum: Gender, example: 'M' })
  gender?: Gender;

  @ApiPropertyOptional({ description: '소개 제목', example: '안녕하세요!' })
  introTitle?: string;

  @ApiPropertyOptional({ description: '소개 내용', example: '저는 철민입니다. 반갑습니다!' })
  introContent?: string;

  @ApiPropertyOptional({ description: '해시태그 (쉼표 구분)', example: '뷰티킹,메디컬,셀프스타일링' })
  hashtags?: string;

  @ApiPropertyOptional({ description: '특징 제목', example: '나의 특징' })
  featureTitle?: string;

  @ApiPropertyOptional({ description: '특징 내용', example: '친절하고 꼼꼼합니다' })
  featureContent?: string;

  @ApiPropertyOptional({ description: '말투 제목', example: '나의 말투' })
  speechTitle?: string;

  @ApiPropertyOptional({ description: '말투 내용', example: '친근하게 대화합니다' })
  speechContent?: string;

  @ApiPropertyOptional({ description: '말투 이미지 URL', example: 'https://example.com/speech.png' })
  speechImageUrl?: string;

  @ApiPropertyOptional({ description: '친밀도 제목', example: '친밀도 레벨' })
  intimacyTitle?: string;

  @ApiPropertyOptional({ description: '친밀도 내용', example: '대화할수록 친해집니다' })
  intimacyContent?: string;

  @ApiPropertyOptional({ description: '친밀도 이미지 URL', example: 'https://example.com/intimacy.png' })
  intimacyImageUrl?: string;

  @ApiProperty({ description: '활성화 여부', example: true })
  isActive: boolean;

  @ApiProperty({ description: '정렬 순서', example: 0 })
  sortOrder: number;

  @ApiProperty({ description: '생성일시', example: '2024-01-01T00:00:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({ description: '수정일시', example: '2024-01-01T00:00:00.000Z' })
  updatedAt?: string;
}

/**
 * AI 페르소나 목록 응답 DTO
 */
export class AiPersonaListResponseDto {
  @ApiProperty({
    description: '페르소나 목록',
    type: [AiPersonaResponseDto],
    example: [
      {
        id: 1,
        name: '철민님',
        description: '친근하고 따뜻한 페르소나입니다',
        personality: '친근한 말투를 사용하며 "어이구~" 같은 표현을 즐겨 사용합니다',
        personaUrl: 'https://example.com/persona1.png',
        isActive: true,
        sortOrder: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }
    ]
  })
  personas: AiPersonaResponseDto[];

  @ApiProperty({ description: '전체 페르소나 수', example: 3 })
  total: number;
}
