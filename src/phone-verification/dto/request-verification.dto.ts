import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { LocalCode, SexCode, TelecomCode } from '../kcp/kcp.types';

/**
 * 본인인증 요청 DTO
 * - KCP 1단계(실명확인) + 2단계(SMS발송) 자동 처리
 */
export class RequestVerificationDto {
  @ApiProperty({
    description: '휴대폰 번호 (하이픈 없이)',
    example: '01012345678',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^01[0-9]{8,9}$/, {
    message: '올바른 휴대폰 번호 형식이 아닙니다.',
  })
  phoneNumber: string;

  @ApiProperty({
    description: '생년월일 (YYYYMMDD)',
    example: '19900101',
  })
  @IsNotEmpty()
  @IsString()
  @Length(8, 8)
  @Matches(/^\d{8}$/, {
    message: '생년월일은 8자리 숫자로 입력해주세요. (YYYYMMDD)',
  })
  birthDay: string;

  @ApiProperty({
    description: '명의자 이름',
    example: '홍길동',
  })
  @IsNotEmpty()
  @IsString()
  userName: string;

  @ApiProperty({
    description: '통신사 코드',
    enum: TelecomCode,
    example: TelecomCode.KTF,
  })
  @IsNotEmpty()
  @IsEnum(TelecomCode)
  telecom: TelecomCode;

  @ApiProperty({
    description: '성별 코드 (01: 남성, 02: 여성)',
    enum: SexCode,
    example: SexCode.MALE,
  })
  @IsNotEmpty()
  @IsEnum(SexCode)
  sex: SexCode;

  @ApiProperty({
    description: '내/외국인 코드 (01: 내국인, 02: 외국인)',
    enum: LocalCode,
    example: LocalCode.LOCAL,
    default: LocalCode.LOCAL,
  })
  @IsEnum(LocalCode)
  localCode: LocalCode = LocalCode.LOCAL;
}
