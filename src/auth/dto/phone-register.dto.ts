import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, IsIn, IsOptional } from 'class-validator';

/**
 * 휴대폰 회원가입 DTO
 * 휴대폰 본인인증 완료 후 회원가입 시 사용
 */
export class PhoneRegisterDto {
  @ApiProperty({
    description: '본인인증 거래번호 (phone-verification/verify에서 받은 값)',
    example: '25559289787324',
  })
  @IsString()
  @IsNotEmpty({ message: '본인인증 거래번호를 입력해주세요.' })
  certNumber: string;

  @ApiProperty({
    description: '이름',
    example: '홍길동',
  })
  @IsString()
  @IsNotEmpty({ message: '이름을 입력해주세요.' })
  name: string;

  @ApiProperty({
    description: '생년월일 (YYYYMMDD)',
    example: '19900101',
  })
  @IsString()
  @IsNotEmpty({ message: '생년월일을 입력해주세요.' })
  @Matches(/^\d{8}$/, {
    message: '생년월일은 8자리 숫자로 입력해주세요. (YYYYMMDD)',
  })
  birthDate: string;

  @ApiProperty({
    description: '통신사 코드',
    example: 'SKT',
    enum: ['SKT', 'KTF', 'LGT', 'SKM', 'KTM', 'LGM'],
  })
  @IsString()
  @IsNotEmpty({ message: '통신사를 선택해주세요.' })
  @IsIn(['SKT', 'KTF', 'LGT', 'SKM', 'KTM', 'LGM'], {
    message: '올바른 통신사 코드가 아닙니다.',
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

  @ApiProperty({
    description: '성별 코드 (01: 남자, 02: 여자)',
    example: '01',
  })
  @IsString()
  @IsNotEmpty({ message: '성별을 입력해주세요.' })
  @Matches(/^(01|02)$/, {
    message: '성별 코드는 01(남자) 또는 02(여자)만 가능합니다.',
  })
  sex: string;

  @ApiProperty({
    description: '내외국인 구분 (01: 내국인, 02: 외국인)',
    example: '01',
  })
  @IsString()
  @IsNotEmpty({ message: '내외국인 구분을 입력해주세요.' })
  @Matches(/^(01|02)$/, {
    message: '내외국인 코드는 01(내국인) 또는 02(외국인)만 가능합니다.',
  })
  localCode: string;

  @ApiProperty({
    description: '[필수] 서비스 이용약관 동의',
    example: true,
  })
  @IsNotEmpty({ message: '서비스 이용약관 동의는 필수입니다.' })
  agreeToTerms: boolean;

  @ApiProperty({
    description: '[필수] 만 14세 이상 확인',
    example: true,
  })
  @IsNotEmpty({ message: '만 14세 이상 확인은 필수입니다.' })
  agreeToAge14: boolean;

  @ApiProperty({
    description: '[필수] 개인정보 수집 이용 동의',
    example: true,
  })
  @IsNotEmpty({ message: '개인정보 수집 이용 동의는 필수입니다.' })
  agreeToPrivacy: boolean;

  @ApiProperty({
    description: '[선택] 제3자 정보 제공 동의',
    example: false,
    required: false,
  })
  @IsOptional()
  agreeToThirdParty?: boolean;

  @ApiProperty({
    description: '[선택] 마케팅 알림 수신 동의',
    example: false,
    required: false,
  })
  @IsOptional()
  agreeToMarketing?: boolean;
}
