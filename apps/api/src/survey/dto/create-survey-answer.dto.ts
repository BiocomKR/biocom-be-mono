import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, IsString, IsIn } from 'class-validator';

/**
 * 설문 답변 생성 요청 DTO
 * 사용자가 설문에 참여하여 답변을 제출할 때 사용
 */
export class CreateSurveyAnswerDto {
  /**
   * 답변자 사용자 ID (내부용)
   * 미들웨어에서 이메일을 통해 자동으로 설정되므로 클라이언트에서 전송하지 않음
   */
  userId?: number;

  /**
   * 선택한 답변 선택지 ID
   * 사용자가 선택한 설문 선택지의 식별자
   */
  @ApiProperty({
    description: '선택한 답변 선택지 ID',
    example: 3,
  })
  @IsInt({ message: '선택지 ID는 정수여야 합니다.' })
  @IsNotEmpty({ message: '선택지 ID는 필수 입력 항목입니다.' })
  surveyOptionId: number;

  /**
   * 답변한 질문 ID
   * 답변 대상이 되는 설문 질문의 식별자
   */
  @ApiProperty({
    description: '답변한 질문 ID',
    example: 1,
  })
  @IsInt({ message: '질문 ID는 정수여야 합니다.' })
  @IsNotEmpty({ message: '질문 ID는 필수 입력 항목입니다.' })
  surveyQuestionId: number;

  /**
   * 설문 구분 타입
   * 사전 설문인지 사후 설문인지를 구분
   * 'before': 사전 설문, 'after': 사후 설문
   */
  @ApiProperty({
    description: '설문 구분 (before: 사전설문, after: 사후설문)',
    example: 'before',
    enum: ['before', 'after'],
  })
  @IsString({ message: '설문 구분은 문자열이어야 합니다.' })
  @IsIn(['before', 'after'], { message: '설문 구분은 before 또는 after만 가능합니다.' })
  @IsNotEmpty({ message: '설문 구분은 필수 입력 항목입니다.' })
  type: 'before' | 'after';
}