import { IsDateString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 챌린지 시작일 설정 요청 DTO
 */
export class SetStartDateDto {
  @ApiProperty({
    description: '챌린지 시작일 (YYYY-MM-DD)',
    example: '2024-09-10',
    type: 'string',
    format: 'date'
  })
  @IsDateString()
  startDate: string;
}

/**
 * 챌린지 시작일 수정 요청 DTO
 */
export class UpdateStartDateDto {
  @ApiProperty({
    description: '변경할 챌린지 시작일 (YYYY-MM-DD)',
    example: '2024-09-12',
    type: 'string',
    format: 'date'
  })
  @IsDateString()
  startDate: string;
}

/**
 * 챌린지 일정 응답 DTO
 */
export class ChallengeScheduleResponseDto {
  @ApiProperty({
    description: '일정 ID',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: '챌린지 시작일',
    example: '2024-09-10',
    type: 'string',
    format: 'date',
    nullable: true
  })
  startDate: string | null;

  @ApiProperty({
    description: '배송일 (시작일 -1일, 평일만)',
    example: '2024-09-09',
    type: 'string',
    format: 'date',
    nullable: true
  })
  deliveryDate: string | null;

  @ApiProperty({
    description: '종료일 (시작일 +20일)',
    example: '2024-09-30',
    type: 'string',
    format: 'date',
    nullable: true
  })
  endDate: string | null;

  @ApiProperty({
    description: '시작일 확정 여부',
    example: false
  })
  isConfirmed: boolean;

  @ApiProperty({
    description: '시작일 수정 가능 여부',
    example: true
  })
  canModify: boolean;

  @ApiProperty({
    description: '챌린지 구매일',
    example: '2024-09-01T10:30:00Z'
  })
  purchasedAt: Date;

  @ApiProperty({
    description: '최대 설정 가능한 시작일 (구매일 +30일)',
    example: '2024-10-01',
    type: 'string',
    format: 'date'
  })
  maxStartDate: string;

  @ApiProperty({
    description: '생성일시',
    example: '2024-09-01T10:30:00Z'
  })
  createdAt: Date;
}

/**
 * 시작일 확정 요청 DTO
 */
export class ConfirmStartDateDto {
  @ApiProperty({
    description: '시작일 확정 여부',
    example: true
  })
  @IsBoolean()
  confirm: boolean;
}