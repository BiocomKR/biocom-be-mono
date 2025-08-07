import { ApiProperty } from '@nestjs/swagger';

export class QuizOptionDto {
  @ApiProperty({
    description: '선택값',
    example: 1,
  })
  value: number;

  @ApiProperty({
    description: '표시 텍스트',
    example: '500ml',
  })
  label: string;
}