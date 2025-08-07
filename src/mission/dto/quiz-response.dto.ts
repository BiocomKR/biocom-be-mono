import { ApiProperty } from '@nestjs/swagger';
import { QuizOptionDto } from './quiz-option.dto';

export class QuizResponseDto {
  @ApiProperty({
    description: '퀴즈 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '챌린지 일차',
    example: 1,
  })
  day: number;

  @ApiProperty({
    description: '퀴즈 질문',
    example: '퀴즈1: 하루에 권장되는 물 섭취량은?',
  })
  question: string;

  @ApiProperty({
    description: '선택지 목록',
    example: [
      { value: 1, label: '500ml' },
      { value: 2, label: '1L' },
      { value: 3, label: '2L' },
      { value: 4, label: '3L' }
    ],
    type: [QuizOptionDto],
  })
  options: QuizOptionDto[];

  @ApiProperty({
    description: '획득 가능 포인트',
    example: 200,
  })
  points: number;
}