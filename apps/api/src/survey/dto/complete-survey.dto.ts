import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { SurveyType } from '../../common/enums';

class SurveyAnswerDto {
  @ApiProperty({
    description: '질문 ID',
    example: 1
  })
  @IsNumber()
  questionId: number;

  @ApiProperty({
    description: '선택한 옵션 ID (1: 그렇지 않다, 2: 약간 그렇지 않다, 3: 보통이다, 4: 약간 그렇다, 5: 그렇다)',
    example: 3
  })
  @IsNumber()
  optionId: number;
}

export class CompleteSurveyDto {
  @ApiProperty({
    description: '설문 타입',
    enum: SurveyType,
    example: SurveyType.BEFORE
  })
  @IsEnum(SurveyType)
  type: SurveyType;

  @ApiProperty({ 
    description: '설문 답변 목록 (20개 질문에 대한 답변)',
    type: [SurveyAnswerDto],
    example: [
      { questionId: 1, optionId: 1 },  // 피부 건강 질문 1 - 그렇지 않다 (0점)
      { questionId: 2, optionId: 2 },  // 피부 건강 질문 2 - 약간 그렇지 않다 (-3점)
      { questionId: 3, optionId: 3 },  // 피부 건강 질문 3 - 보통이다 (-7점)
      { questionId: 4, optionId: 4 },  // 피부 건강 질문 4 - 약간 그렇다 (-10점)
      { questionId: 5, optionId: 5 },  // 피부 건강 질문 5 - 그렇다 (-14점)
      { questionId: 6, optionId: 1 },  // 대사 건강 질문 1
      { questionId: 7, optionId: 2 },  // 대사 건강 질문 2
      { questionId: 8, optionId: 3 },  // 대사 건강 질문 3
      { questionId: 9, optionId: 4 },  // 대사 건강 질문 4
      { questionId: 10, optionId: 5 }, // 대사 건강 질문 5
      { questionId: 11, optionId: 1 }, // 면역 밸런스 질문 1
      { questionId: 12, optionId: 2 }, // 면역 밸런스 질문 2
      { questionId: 13, optionId: 3 }, // 면역 밸런스 질문 3
      { questionId: 14, optionId: 4 }, // 면역 밸런스 질문 4
      { questionId: 15, optionId: 5 }, // 면역 밸런스 질문 5
      { questionId: 16, optionId: 1 }, // 장 건강 질문 1
      { questionId: 17, optionId: 2 }, // 장 건강 질문 2
      { questionId: 18, optionId: 3 }, // 장 건강 질문 3
      { questionId: 19, optionId: 4 }, // 장 건강 질문 4
      { questionId: 20, optionId: 5 }, // 장 건강 질문 5
      { questionId: 21, optionId: 1 }, // 수면 질문 1
      { questionId: 22, optionId: 2 }, // 수면 질문 2
      { questionId: 23, optionId: 3 }, // 수면 질문 3
      { questionId: 24, optionId: 4 }, // 수면 질문 4
      { questionId: 25, optionId: 5 }  // 수면 질문 5
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyAnswerDto)
  answers: SurveyAnswerDto[];
}