import { ApiProperty } from '@nestjs/swagger';

export class SurveyStatusResponseDto {
  @ApiProperty({ 
    description: '사전 설문 완료 여부', 
    example: true 
  })
  beforeCompleted: boolean;

  @ApiProperty({ 
    description: '사전 설문 완료일', 
    example: '2024-01-13T10:00:00Z',
    required: false 
  })
  beforeCompletedAt?: Date;

  @ApiProperty({ 
    description: '사후 설문 완료 여부', 
    example: false 
  })
  afterCompleted: boolean;

  @ApiProperty({ 
    description: '사후 설문 완료일', 
    example: null,
    required: false 
  })
  afterCompletedAt?: Date;

  @ApiProperty({ 
    description: '사후 설문 가능 여부', 
    example: false 
  })
  canTakeAfterSurvey: boolean;

  @ApiProperty({ 
    description: '사후 설문 가능 예정일', 
    example: '2024-02-03T10:00:00Z',
    required: false 
  })
  afterSurveyAvailableDate?: Date;

  @ApiProperty({ 
    description: '챌린지 진행 일수', 
    example: 5,
    required: false 
  })
  challengeDaysElapsed?: number;

  @ApiProperty({ 
    description: 'before 설문 완료 후 경과 일수', 
    example: 10,
    required: false 
  })
  daysSinceBeforeSurvey?: number;

  @ApiProperty({ 
    description: 'after 설문까지 남은 일수', 
    example: 11,
    required: false 
  })
  daysRemaining?: number;

  @ApiProperty({ 
    description: '다음 필요한 액션', 
    example: 'CHALLENGE_IN_PROGRESS',
    enum: ['TAKE_BEFORE_SURVEY', 'CHALLENGE_IN_PROGRESS', 'TAKE_AFTER_SURVEY', 'ALL_COMPLETED']
  })
  nextAction: string;
}