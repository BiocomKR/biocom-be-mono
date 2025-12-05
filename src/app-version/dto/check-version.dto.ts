import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckVersionDto {
  @ApiProperty({
    description: '플랫폼',
    example: 'IOS',
    enum: ['IOS', 'ANDROID', 'WEB'],
  })
  @IsString()
  @IsNotEmpty()
  platform: string;

  @ApiProperty({
    description: '현재 앱 버전',
    example: '1.0.0',
  })
  @IsString()
  @IsNotEmpty()
  version: string;
}
