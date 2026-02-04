import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * 휴대폰 간편 인증 요청 DTO
 * 통신사 + 휴대폰번호만으로 본인인증 시작
 */
export class PhoneRequestDto {
  @ApiProperty({
    description: '통신사 코드',
    example: 'SKT',
    enum: ['SKT', 'KTF', 'LGT', 'SKM', 'KTM', 'LGM'],
  })
  @IsString()
  @IsNotEmpty({ message: '통신사를 선택해주세요.' })
  @Matches(/^(SKT|KTF|LGT|SKM|KTM|LGM)$/, {
    message: '올바른 통신사 코드를 입력해주세요.',
  })
  telecom: string;

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
