import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min } from 'class-validator';

/**
 * 설문 질문 생성 요청 DTO
 * 새로운 설문 질문을 생성할 때 필요한 데이터를 정의
 */
export class CreateSurveyQuestionDto {
  /**
   * 질문 카테고리
   * 설문 질문의 분류를 위한 카테고리 (예: 피부 건강(염증), 대사 건강 등)
   */
  @ApiProperty({
    description: '질문 카테고리 (예: 피부 건강(염증), 대사 건강)',
    example: '피부 건강(염증)',
  })
  @IsString({ message: '카테고리는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '카테고리는 필수 입력 항목입니다.' })
  category: string;

  /**
   * 카테고리 코드
   * API 호출 시 사용할 카테고리 식별 코드 (예: SKIN_HEALTH, METABOLISM 등)
   */
  @ApiProperty({
    description: '카테고리 코드 (예: SKIN_HEALTH, METABOLISM)',
    example: 'SKIN_HEALTH',
  })
  @IsString({ message: '카테고리 코드는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '카테고리 코드는 필수 입력 항목입니다.' })
  categoryCode: string;

  /**
   * 실제 질문 내용
   * 사용자에게 표시될 질문 텍스트
   */
  @ApiProperty({
    description: '질문 내용',
    example: '현재 건강 상태는 어떻습니까?',
  })
  @IsString({ message: '질문 내용은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '질문 내용은 필수 입력 항목입니다.' })
  questionText: string;

  /**
   * 질문 표시 순서
   * 설문지에서 질문이 표시되는 순서를 결정
   */
  @ApiProperty({
    description: '질문 표시 순서',
    example: 1,
    minimum: 1,
  })
  @IsInt({ message: '표시 순서는 정수여야 합니다.' })
  @Min(1, { message: '표시 순서는 1 이상이어야 합니다.' })
  sortOrder: number;
}
