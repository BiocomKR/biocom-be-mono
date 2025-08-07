import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt } from 'class-validator';

/**
 * 설문 선택지 생성 요청 DTO
 * 설문 질문에 대한 선택 가능한 답변 옵션을 생성할 때 사용
 */
export class CreateSurveyOptionDto {
  /**
   * 연결된 설문 질문의 식별자
   * 이 선택지가 속할 질문의 ID
   */
  @ApiProperty({
    description: '연결된 설문 질문 ID',
    example: 1,
  })
  @IsInt({ message: '설문 질문 ID는 정수여야 합니다.' })
  @IsNotEmpty({ message: '설문 질문 ID는 필수 입력 항목입니다.' })
  surveyQuestionId: number;

  /**
   * 선택지 텍스트 내용
   * 사용자에게 표시될 선택지 텍스트
   */
  @ApiProperty({
    description: '선택지 내용',
    example: '매우 좋음',
  })
  @IsString({ message: '선택지 내용은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '선택지 내용은 필수 입력 항목입니다.' })
  optionText: string;

  /**
   * 선택지 점수
   * 해당 선택지 선택 시 부여되는 점수 (분석 및 평가용)
   */
  @ApiProperty({
    description: '선택지 점수 (분석용)',
    example: 5,
  })
  @IsInt({ message: '점수는 정수여야 합니다.' })
  @IsNotEmpty({ message: '점수는 필수 입력 항목입니다.' })
  score: number;
}