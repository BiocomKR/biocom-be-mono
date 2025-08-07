import { ApiProperty } from '@nestjs/swagger';

/**
 * API Key 응답 DTO
 * API Key 정보를 반환할 때 사용하는 DTO
 */
export class ApiKeyResponseDto {
  @ApiProperty({
    description: 'API Key ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'API Key (UUID 형식)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  key: string;

  @ApiProperty({
    description: 'API Key 식별 이름',
    example: '프로덕션 백오피스',
  })
  name: string;

  @ApiProperty({
    description: 'API Key 설명',
    example: '프로덕션 환경 백오피스에서 사용하는 API Key',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'API Key 활성화 상태',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: '마지막 사용 시간',
    example: '2024-03-19T14:30:00Z',
    nullable: true,
  })
  lastUsedAt: Date | null;

  @ApiProperty({
    description: '생성 시간',
    example: '2024-03-19T10:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '수정 시간',
    example: '2024-03-19T14:30:00Z',
  })
  updatedAt: Date;
}

/**
 * API Key 목록 응답 DTO
 * 보안을 위해 목록 조회 시에는 key 값을 일부만 노출
 */
export class ApiKeyListResponseDto {
  @ApiProperty({
    description: 'API Key ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'API Key (앞 8자리만 노출)',
    example: '550e8400-****',
  })
  keyPreview: string;

  @ApiProperty({
    description: 'API Key 식별 이름',
    example: '프로덕션 백오피스',
  })
  name: string;

  @ApiProperty({
    description: 'API Key 설명',
    example: '프로덕션 환경 백오피스에서 사용하는 API Key',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'API Key 활성화 상태',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: '마지막 사용 시간',
    example: '2024-03-19T14:30:00Z',
    nullable: true,
  })
  lastUsedAt: Date | null;

  @ApiProperty({
    description: '생성 시간',
    example: '2024-03-19T10:00:00Z',
  })
  createdAt: Date;
}