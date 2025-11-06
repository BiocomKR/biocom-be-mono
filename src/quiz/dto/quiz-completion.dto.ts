import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 퀴즈 완료 요청 DTO
 */
export class CompleteQuizDto {
  @ApiProperty({
    description: '챌린지 미션 ID (필수)',
    example: 123
  })
  @IsNumber({}, { message: '챌린지 미션 ID는 숫자여야 합니다' })
  challengeMissionId: number;

  @ApiProperty({
    description: '퀴즈 ID (필수)',
    example: 45
  })
  @IsNumber({}, { message: '퀴즈 ID는 숫자여야 합니다' })
  quizId: number;

  @ApiProperty({
    description: '선택한 답변 번호 (1~4)',
    example: 2
  })
  @IsNumber({}, { message: '답변 번호는 숫자여야 합니다' })
  selectedAnswer: number;
}

/**
 * 강의 퀴즈 완료 요청 DTO
 */
export class CompleteLectureQuizDto {
  @ApiProperty({
    description: '퀴즈 ID',
    example: 10
  })
  @IsNumber({}, { message: '퀴즈 ID는 숫자여야 합니다' })
  quizId: number;

  @ApiProperty({
    description: '선택한 답변 번호 (1~4)',
    example: 2
  })
  @IsNumber({}, { message: '답변 번호는 숫자여야 합니다' })
  selectedAnswer: number;
}

/**
 * 퀴즈 완료 응답 DTO
 */
export class QuizCompletionResponseDto {
  @ApiProperty({
    description: '완료된 퀴즈 정보'
  })
  quiz: {
    id: number;
    title: string;
    question: string;
    correctAnswer: number;
  };

  @ApiProperty({
    description: '사용자가 선택한 답변',
    example: 2
  })
  selectedAnswer: number;

  @ApiProperty({
    description: '정답 여부',
    example: true
  })
  isCorrect: boolean;

  @ApiProperty({
    description: '획득 포인트',
    example: 50
  })
  pointsEarned: number;

  @ApiProperty({
    description: '풀이 시간 (초)',
    example: 15,
    required: false
  })
  timeSpent?: number;

  @ApiProperty({
    description: '답변 제출 일시'
  })
  answeredAt: Date;

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