import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AnswerIssueReportDto {
  @ApiProperty({ description: '답변 내용', example: '해당 문제는 다음 업데이트에서 수정될 예정입니다.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  answer: string;
}
