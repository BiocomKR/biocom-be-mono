import { ApiProperty } from '@nestjs/swagger';

/**
 * 얼굴 슬리밍 API 응답 DTO
 * 처리된 이미지의 URL과 처리 정보를 포함
 */
export class FaceSlimmingResponseDto {
  @ApiProperty({
    description: '원본 이미지의 Google Storage URL',
    example: 'https://storage.googleapis.com/api-dev-biocom-uploads/original_face.jpg'
  })
  beforeImageUrl: string;

  @ApiProperty({
    description: '처리된 이미지의 Google Storage URL',
    example: 'https://storage.googleapis.com/api-dev-biocom-uploads/face-slimming_2025-09-12T06-16-46-014Z_face.jpg'
  })
  afterImageUrl: string;

  @ApiProperty({
    description: '적용된 체중 감량 효과 (kg)',
    example: 5
  })
  weightLoss: number;

  @ApiProperty({
    description: '처리 시간 (초)',
    example: 12.5
  })
  processingTime: number;

  @ApiProperty({
    description: '원본 이미지 파일명',
    example: 'original_face.jpg'
  })
  originalFileName: string;

  @ApiProperty({
    description: '처리 성공 여부',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: '에러 메시지 (실패시)',
    example: null,
    required: false
  })
  errorMessage?: string;

  @ApiProperty({
    description: '재시도 횟수',
    example: 0
  })
  retryCount: number;

  @ApiProperty({
    description: '파일 저장 위치',
    example: 'google-storage',
    enum: ['google-storage', 'local-fallback'],
    required: false
  })
  storageLocation?: 'google-storage' | 'local-fallback';
}

