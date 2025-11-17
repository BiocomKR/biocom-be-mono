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

  // ⚠️ 배송 관련 필드 제거됨 (도시락 배송 정책 폐지)
  // @ApiProperty({
  //   description: '배송시작일 (배송도착일 2일전)',
  //   example: '2024-09-05',
  //   type: 'string',
  //   format: 'date',
  //   nullable: true
  // })
  // deliveryStartDate: string | null;

  // @ApiProperty({
  //   description: '배송도착예정일 (시작일 전주 금요일)',
  //   example: '2024-09-07',
  //   type: 'string',
  //   format: 'date',
  //   nullable: true
  // })
  // deliveryArrivalDate: string | null;

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