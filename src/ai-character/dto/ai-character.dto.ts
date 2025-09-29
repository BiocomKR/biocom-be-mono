import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  MaxLength
} from 'class-validator';

/**
 * AI 캐릭터 생성 요청 DTO
 */
export class CreateAiCharacterDto {
  @ApiProperty({ description: '캐릭터 이름', example: '철민님', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ description: '캐릭터 설명', example: '친근하고 따뜻한 캐릭터입니다' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: '캐릭터 성격/대화 스타일',
    example: '친근한 말투를 사용하며 "어이구~", "그래그래~" 같은 표현을 즐겨 사용합니다'
  })
  @IsOptional()
  @IsString()
  personality?: string;

  @ApiPropertyOptional({ description: '캐릭터 이미지 URL', example: 'https://example.com/character.png' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: '정렬 순서', example: 1, default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

/**
 * AI 캐릭터 수정 요청 DTO
 */
export class UpdateAiCharacterDto {
  @ApiPropertyOptional({ description: '캐릭터 이름', example: '철민님 (수정됨)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ description: '캐릭터 설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '캐릭터 성격/대화 스타일' })
  @IsOptional()
  @IsString()
  personality?: string;

  @ApiPropertyOptional({ description: '캐릭터 이미지 URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

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
 * AI 캐릭터 응답 DTO
 */
export class AiCharacterResponseDto {
  @ApiProperty({ description: '캐릭터 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '캐릭터 이름', example: '철민님' })
  name: string;

  @ApiPropertyOptional({ description: '캐릭터 설명', example: '친근하고 따뜻한 캐릭터입니다' })
  description?: string;

  @ApiPropertyOptional({ description: '캐릭터 성격/대화 스타일' })
  personality?: string;

  @ApiPropertyOptional({ description: '캐릭터 이미지 URL' })
  avatarUrl?: string;

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
 * AI 캐릭터 목록 응답 DTO
 */
export class AiCharacterListResponseDto {
  @ApiProperty({
    description: '캐릭터 목록',
    type: [AiCharacterResponseDto],
    example: [
      {
        id: 1,
        name: '철민님',
        description: '친근하고 따뜻한 캐릭터입니다',
        personality: '친근한 말투를 사용하며 "어이구~" 같은 표현을 즐겨 사용합니다',
        avatarUrl: 'https://example.com/character1.png',
        isActive: true,
        sortOrder: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }
    ]
  })
  characters: AiCharacterResponseDto[];

  @ApiProperty({ description: '전체 캐릭터 수', example: 3 })
  total: number;
}