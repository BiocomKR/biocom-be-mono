import { IsOptional, IsString, IsNumber, IsObject, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 미션 완료 요청 DTO
 */
export class CompleteMissionDto {
  @ApiProperty({
    description: '파일 업로드 ID (인증샷이 필요한 미션)',
    example: 123,
    required: false
  })
  @IsOptional()
  @IsNumber({}, { message: '파일 업로드 ID는 숫자여야 합니다' })
  fileUploadId?: number;

  @ApiProperty({
    description: '기록 값 (기록형 미션의 경우 필수)',
    example: '8',
    required: false
  })
  @IsOptional()
  @IsString({ message: '기록 값은 문자열이어야 합니다' })
  @ValidateIf((o, value) => value !== null && value !== undefined)
  value?: string;

  @ApiProperty({
    description: '단위 (기록형 미션)',
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
 * 미션 완료 응답 DTO
 */
export class MissionCompletionResponseDto {
  @ApiProperty({
    description: '완료된 미션 정보'
  })
  mission: {
    id: number;
    name: string;
    type: string;
    points: number;
  };

  @ApiProperty({
    description: '획득 포인트',
    example: 100
  })
  pointsEarned: number;

  @ApiProperty({
    description: '완료 일시'
  })
  completedAt: Date;

  @ApiProperty({
    description: '생성된 기록 ID (기록형 미션의 경우)',
    required: false
  })
  trackingRecordId?: number;

  @ApiProperty({
    description: '오늘의 진행 상황 업데이트'
  })
  todayProgress: {
    missionsCompleted: number;
    pointsEarned: number;
  };
}