import { IsOptional, IsString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 기록 완료 요청 DTO
 */
export class CompleteRecordDto {
  @ApiProperty({
    description: '기록 값',
    example: '8'
  })
  @IsString({ message: '기록 값은 문자열이어야 합니다' })
  value: string;

  @ApiProperty({
    description: '단위',
    example: '시간',
    required: false
  })
  @IsOptional()
  @IsString({ message: '단위는 문자열이어야 합니다' })
  unit?: string;

  @ApiProperty({
    description: '추가 메타데이터',
    example: { photo: 'https://example.com/photo.jpg', note: '잘 잤음' },
    required: false
  })
  @IsOptional()
  @IsObject({ message: '메타데이터는 객체여야 합니다' })
  metadata?: any;
}

/**
 * 기록 완료 응답 DTO
 */
export class RecordCompletionResponseDto {
  @ApiProperty({
    description: '생성된 기록 정보'
  })
  record: {
    id: number;
    recordType: string;
    value: string;
    unit?: string;
  };

  @ApiProperty({
    description: '기록 생성 일시'
  })
  recordedAt: Date;

  @ApiProperty({
    description: '연관 미션 완료 정보 (있는 경우)',
    required: false
  })
  missionCompletion?: {
    missionId: number;
    missionName: string;
    pointsEarned: number;
  };
}