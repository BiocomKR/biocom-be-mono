import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, IsIn, IsArray, ValidateNested, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 약관 동의 항목 DTO
 */
export class ConsentAgreementDto {
  @ApiProperty({
    description: '약관 ID (consents 테이블의 id)',
    example: 1,
  })
  @IsNumber()
  consentId: number;

  @ApiProperty({
    description: '동의 여부',
    example: true,
  })
  @IsBoolean()
  isAgreed: boolean;
}

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
    description: '약관 동의 목록',
    type: [ConsentAgreementDto],
    example: [
      { consentId: 1, isAgreed: true },
      { consentId: 2, isAgreed: true },
      { consentId: 3, isAgreed: true },
      { consentId: 4, isAgreed: false },
      { consentId: 5, isAgreed: true },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentAgreementDto)
  consents: ConsentAgreementDto[];
}

//--------------------- TEST ---------------------
/**
 * 테스트용 개별 회원 정보 DTO
 * 배열로 직접 전달받음
 */
export class PhoneRegisterTestDto {
  @ApiProperty({
    description: '이름',
    example: '최대길',
  })
  @IsString()
  @IsNotEmpty({ message: '이름을 입력해주세요.' })
  name: string;

  @ApiProperty({
    description: '휴대폰 번호 (하이픈 없이)',
    example: '01056060746',
  })
  @IsString()
  @IsNotEmpty({ message: '휴대폰 번호를 입력해주세요.' })
  @Matches(/^01[0-9]{8,9}$/, {
    message: '올바른 휴대폰 번호 형식이 아닙니다.',
  })
  mobile: string;

  @ApiProperty({
    description: '생년월일 (YYYYMMDD)',
    example: '19781117',
  })
  @IsString()
  @IsNotEmpty({ message: '생년월일을 입력해주세요.' })
  @Matches(/^\d{8}$/, {
    message: '생년월일은 8자리 숫자로 입력해주세요. (YYYYMMDD)',
  })
  birthDate: string;

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
    description: '통신사 코드',
    example: 'SKM',
    enum: ['SKT', 'KTF', 'LGT', 'SKM', 'KTM', 'LGM'],
  })
  @IsString()
  @IsNotEmpty({ message: '통신사를 선택해주세요.' })
  @IsIn(['SKT', 'KTF', 'LGT', 'SKM', 'KTM', 'LGM'], {
    message: '올바른 통신사 코드가 아닙니다.',
  })
  telecom: string;
}
