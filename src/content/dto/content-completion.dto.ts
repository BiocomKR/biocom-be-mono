import { ApiProperty } from '@nestjs/swagger';

/**
 * 컨텐츠 시청 완료 응답 DTO
 */
export class ContentCompletionResponseDto {
  @ApiProperty({
    description: '시청 완료된 컨텐츠 정보'
  })
  content: {
    id: number;
    title: string;
    type: string;
  };

  @ApiProperty({
    description: '시청 완료 일시'
  })
  viewedAt: Date;

  @ApiProperty({
    description: '최초 시청 여부',
    example: true
  })
  isFirstView: boolean;

  @ApiProperty({
    description: '획득 포인트 (최초 시청 시에만)',
    example: 50,
    required: false
  })
  pointsEarned?: number;

  @ApiProperty({
    description: '챌린지 연관 정보 (활성 챌린지가 있는 경우)',
    required: false
  })
  challengeInfo?: {
    challengeId: number;
    challengeName: string;
    currentDay: number;
  };
}