import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsEnum, Min } from 'class-validator';
import { PushLogStatus } from '../enums';

/**
 * 푸시 로그 상태 업데이트 DTO
 *
 * 클라이언트에서 푸시 알림을 읽거나 클릭했을 때 상태를 업데이트하기 위한 DTO
 */
export class UpdatePushLogStatusDto {
  @ApiProperty({
    description: '푸시 알림 로그 ID',
    example: 123,
  })
  @IsInt({ message: '로그 ID는 정수여야 합니다.' })
  @Min(1, { message: '로그 ID는 1 이상이어야 합니다.' })
  logId: number;

  @ApiProperty({
    description: '업데이트할 상태',
    enum: PushLogStatus,
    example: PushLogStatus.READ,
  })
  @IsEnum(PushLogStatus, {
    message: '상태는 READ 또는 CLICKED 중 하나여야 합니다.',
  })
  status: PushLogStatus;
}
