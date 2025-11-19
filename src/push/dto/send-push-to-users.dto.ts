import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber } from 'class-validator';
import { SendPushDto } from './send-push.dto';

/**
 * 여러 유저에게 푸시 전송 DTO
 */
export class SendPushToUsersDto extends SendPushDto {
  @ApiProperty({
    description: '대상 유저 ID 배열',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  userIds: number[];
}
