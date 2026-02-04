import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { SendPushDto } from './send-push.dto';

/**
 * 전체 유저에게 푸시 전송 DTO
 */
export class SendPushToAllDto extends SendPushDto {
  @ApiPropertyOptional({
    description: '마케팅 수신 동의한 유저에게만 전송 여부',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  marketingOnly?: boolean;
}
