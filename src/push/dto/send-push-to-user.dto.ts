import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { SendPushDto } from './send-push.dto';

/**
 * 특정 유저에게 푸시 전송 DTO
 */
export class SendPushToUserDto extends SendPushDto {
  @ApiProperty({
    description: '대상 유저 ID',
    example: 1,
  })
  @IsNumber()
  userId: number;
}
