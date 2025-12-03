import { ApiProperty } from '@nestjs/swagger';

export class ConsentDto {
  @ApiProperty({ description: '약관 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '약관 코드', example: 'SERVICE_TERMS' })
  code: string;

  @ApiProperty({ description: '약관 제목', example: '서비스 이용약관' })
  title: string;

  @ApiProperty({ description: '약관 내용', example: '제1조 (목적)...' })
  content: string;

  @ApiProperty({ description: '약관 버전', example: '1.0' })
  version: string;

  @ApiProperty({ description: '필수 동의 여부', example: true })
  isRequired: boolean;

  @ApiProperty({ description: '노출 순서', example: 1 })
  displayOrder: number;
}

export class UserConsentStatusDto {
  @ApiProperty({ description: '약관 ID', example: 1 })
  consentId: number;

  @ApiProperty({ description: '약관 코드', example: 'SERVICE_TERMS' })
  code: string;

  @ApiProperty({ description: '약관 제목', example: '서비스 이용약관' })
  title: string;

  @ApiProperty({ description: '약관 버전', example: '1.0' })
  version: string;

  @ApiProperty({ description: '필수 동의 여부', example: true })
  isRequired: boolean;

  @ApiProperty({ description: '동의 여부', example: true })
  isAgreed: boolean;

  @ApiProperty({ description: '동의 일시', example: '2025-11-25T10:00:00.000Z', nullable: true })
  agreedAt: Date | null;
}
