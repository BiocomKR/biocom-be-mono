import { ApiProperty } from '@nestjs/swagger';

/**
 * 설문 선택지 응답 DTO
 * API 응답으로 설문 선택지 정보를 반환할 때 사용
 */
export class SurveyOptionResponseDto {
  /**
   * 선택지 고유 식별자
   */
  @ApiProperty({
    description: '선택지 고유 식별자',
    example: 1,
  })
  id: number;

  /**
   * 연결된 질문 ID (호환성을 위해 유지, 실제로는 0 반환)
   */
  @ApiProperty({
    description: '연결된 질문 ID (공통 선택지이므로 항상 0)',
    example: 0,
  })
  surveyQuestionId: number;

  /**
   * 선택지 내용
   */
  @ApiProperty({
    description: '선택지 내용',
    example: '보통이다',
  })
  optionText: string;

  /**
   * 선택지 점수
   */
  @ApiProperty({
    description: '선택지 점수 (낮을수록 증상이 심함)',
    example: -7,
  })
  score: number;

  /**
   * 선택지 생성일시
   */
  @ApiProperty({
    description: '선택지 생성일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  /**
   * 선택지 최종 수정일시
   */
  @ApiProperty({
    description: '선택지 최종 수정일시',
    example: '2024-01-02T12:30:00.000Z',
    required: false,
  })
  updatedAt?: Date;
}

/**
 * 설문 질문 응답 DTO
 * API 응답으로 설문 질문 정보를 반환할 때 사용
 */
export class SurveyQuestionResponseDto {
  /**
   * 질문 고유 식별자
   */
  @ApiProperty({
    description: '질문 고유 식별자',
    example: 1,
  })
  id: number;

  /**
   * 질문 카테고리
   */
  @ApiProperty({
    description: '질문 카테고리',
    example: '피부 건강(염증)',
  })
  category: string;

  /**
   * 카테고리 코드
   */
  @ApiProperty({
    description: '카테고리 코드',
    example: 'SKIN_HEALTH',
  })
  categoryCode: string;

  /**
   * 질문 내용
   */
  @ApiProperty({
    description: '질문 내용',
    example: '현재 건강 상태는 어떻습니까?',
  })
  questionText: string;

  /**
   * 질문 표시 순서
   */
  @ApiProperty({
    description: '질문 표시 순서',
    example: 1,
  })
  sortOrder: number;

  /**
   * 질문 생성일시
   */
  @ApiProperty({
    description: '질문 생성일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  /**
   * 질문 최종 수정일시
   */
  @ApiProperty({
    description: '질문 최종 수정일시',
    example: '2024-01-02T12:30:00.000Z',
    required: false,
  })
  updatedAt?: Date;

  /**
   * 해당 질문의 선택지 목록
   */
  @ApiProperty({
    description: '질문의 선택지 목록',
    type: [SurveyOptionResponseDto],
  })
  surveyOptions?: SurveyOptionResponseDto[];
}

/**
 * 설문 답변 응답 DTO
 * API 응답으로 사용자의 설문 답변 정보를 반환할 때 사용
 */
export class SurveyAnswerResponseDto {
  /**
   * 답변 고유 식별자
   */
  @ApiProperty({
    description: '답변 고유 식별자',
    example: 1,
  })
  id: number;

  /**
   * 답변자 사용자 ID
   */
  @ApiProperty({
    description: '답변자 사용자 ID',
    example: 1,
  })
  userId: number;

  /**
   * 선택한 답변 선택지 ID
   */
  @ApiProperty({
    description: '선택한 답변 선택지 ID',
    example: 3,
  })
  surveyOptionId: number;

  /**
   * 답변한 질문 ID
   */
  @ApiProperty({
    description: '답변한 질문 ID',
    example: 1,
  })
  surveyQuestionId: number;

  /**
   * 설문 구분 타입
   */
  @ApiProperty({
    description: '설문 구분 (before: 사전설문, after: 사후설문)',
    example: 'before',
    enum: ['before', 'after'],
  })
  type: string;

  /**
   * 답변 생성일시
   */
  @ApiProperty({
    description: '답변 생성일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  /**
   * 답변 최종 수정일시
   */
  @ApiProperty({
    description: '답변 최종 수정일시',
    example: '2024-01-02T12:30:00.000Z',
    required: false,
  })
  updatedAt?: Date;
}