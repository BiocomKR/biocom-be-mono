import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

/**
 * 휴대폰 로그인 DTO
 * 휴대폰 본인인증 완료 후 로그인 요청 시 사용
 */
export class PhoneLoginDto {
  @ApiProperty({
    description: '본인인증 거래번호 (phone-verification/verify에서 받은 값)',
    example: '25559289787324',
  })
  @IsString()
  @IsNotEmpty({ message: '본인인증 거래번호를 입력해주세요.' })
  certNumber: string;

  @ApiProperty({
    description: '휴대폰 번호 (하이픈 없이)',
    example: '01012345678',
  })
  @IsString()
  @IsNotEmpty({ message: '휴대폰 번호를 입력해주세요.' })
  @Matches(/^01[0-9]{8,9}$/, {
    message: '올바른 휴대폰 번호 형식이 아닙니다.',
  })
  mobile: string;
}
