import { IsNotEmpty, IsString, MaxLength, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBoFeedbackDto {
  @ApiProperty({
    description: '피드백 내용',
    example: '주문 목록 페이지에서 정렬 기능이 제대로 동작하지 않습니다.',
    maxLength: 1000,
  })
  @IsNotEmpty({ message: '내용을 입력해주세요.' })
  @IsString()
  @MaxLength(1000, { message: '내용은 1000자 이내로 입력해주세요.' })
  content: string;

  @ApiPropertyOptional({
    description: '첨부파일 URL 배열',
    example: ['https://storage.googleapis.com/...'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileUrls?: string[];
}
