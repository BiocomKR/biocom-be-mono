import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 휴대폰 번호 중복 체크 요청 DTO
 */
export class CheckMobileDto {
  @ApiProperty({
    description: '휴대폰 번호 (하이픈 없이)',
    example: '01012345678',
  })
  @IsNotEmpty({ message: '휴대폰 번호를 입력해주세요.' })
  @IsString()
  @Matches(/^01[0-9]{8,9}$/, {
    message: '올바른 휴대폰 번호 형식이 아닙니다.',
  })
  mobile: string;
}
