import { ApiProperty } from '@nestjs/swagger';

/**
 * 미션 응답 DTO
 */
export class MissionResponseDto {
  @ApiProperty({
    description: '미션 ID',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: '미션 이름',
    example: '물 8잔 마시기'
  })
  name: string;

  @ApiProperty({
    description: '미션 설명',
    example: '하루에 물 8잔(2L) 마시기'
  })
  description?: string;

  @ApiProperty({
    description: '미션 타입',
    enum: ['MISSION', 'RECORD'],
    example: 'RECORD'
  })
  type: string;

  @ApiProperty({
    description: '기록 타입 (RECORD 타입인 경우)',
    example: 'WATER',
    required: false
  })
  recordType?: string;

  @ApiProperty({
    description: '업로드 필요 여부',
    example: false
  })
  requireUpload: boolean;

  @ApiProperty({
    description: '활성화 상태',
    example: true
  })
  isActive: boolean;

  @ApiProperty({
    description: '생성일시'
  })
  createdAt: Date;
}