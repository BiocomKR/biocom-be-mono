import {
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 배송 주소 생성 DTO
 */
export class CreateAddressDto {
  @ApiPropertyOptional({ description: '주소 별칭 (예: 집, 회사)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  alias?: string;

  @ApiProperty({ description: '수령인 이름', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  recipientName: string;

  @ApiProperty({ description: '수령인 연락처', example: '010-1234-5678' })
  @IsString()
  @MaxLength(20)
  @Matches(/^[\d-]+$/, { message: '연락처는 숫자와 하이픈만 포함해야 합니다' })
  recipientPhone: string;

  @ApiProperty({ description: '우편번호', example: '12345' })
  @IsString()
  @MaxLength(10)
  @Matches(/^\d{5}$/, { message: '우편번호는 5자리 숫자여야 합니다' })
  postalCode: string;

  @ApiProperty({ description: '기본 주소', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  address: string;

  @ApiPropertyOptional({ description: '상세 주소', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressDetail?: string;

  @ApiPropertyOptional({ description: '기본 주소 여부', default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/**
 * 배송 주소 수정 DTO
 */
export class UpdateAddressDto {
  @ApiPropertyOptional({ description: '주소 별칭', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  alias?: string;

  @ApiPropertyOptional({ description: '수령인 이름', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  recipientName?: string;

  @ApiPropertyOptional({ description: '수령인 연락처' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[\d-]+$/, { message: '연락처는 숫자와 하이픈만 포함해야 합니다' })
  recipientPhone?: string;

  @ApiPropertyOptional({ description: '우편번호' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^\d{5}$/, { message: '우편번호는 5자리 숫자여야 합니다' })
  postalCode?: string;

  @ApiPropertyOptional({ description: '기본 주소', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ description: '상세 주소', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressDetail?: string;

  @ApiPropertyOptional({ description: '기본 주소 여부' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/**
 * 배송 주소 응답 DTO
 */
export class AddressResponseDto {
  @ApiProperty({ description: '주소 ID' })
  id: number;

  @ApiPropertyOptional({ description: '주소 별칭' })
  alias: string | null;

  @ApiProperty({ description: '수령인 이름' })
  recipientName: string;

  @ApiProperty({ description: '수령인 연락처' })
  recipientPhone: string;

  @ApiProperty({ description: '우편번호' })
  postalCode: string;

  @ApiProperty({ description: '기본 주소' })
  address: string;

  @ApiPropertyOptional({ description: '상세 주소' })
  addressDetail: string | null;

  @ApiProperty({ description: '기본 주소 여부' })
  isDefault: boolean;

  @ApiProperty({ description: '생성일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정일시' })
  updatedAt: Date;
}
