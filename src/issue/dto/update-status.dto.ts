import { IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FeedbackStatus } from '../../common/enums';

export class UpdateStatusDto {
  @ApiProperty({
    description: '처리 상태',
    example: FeedbackStatus.IN_PROGRESS,
    enum: FeedbackStatus,
  })
  @IsNotEmpty({ message: '상태를 선택해주세요.' })
  @IsEnum(FeedbackStatus, { message: '유효하지 않은 상태입니다.' })
  status: FeedbackStatus;
}
