import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 영양제 섭취 데이터 DTO
 */
export class SupplementIntakeItemDto {
  @ApiProperty({ description: '영양제 상품 ID', example: 4 })
  @IsNumber()
  productId: number;

  @ApiProperty({ description: '아침 섭취 여부', example: true })
  @IsBoolean()
  morning: boolean;

  @ApiProperty({ description: '점심 섭취 여부', example: false })
  @IsBoolean()
  afternoon: boolean;

  @ApiProperty({ description: '저녁 섭취 여부', example: true })
  @IsBoolean()
  evening: boolean;
}

/**
 * 영양제 섭취 기록 저장 요청 DTO
 */
export class SaveSupplementIntakeDto {
  @ApiProperty({
    description: '영양제 사진 URL (당일 최초 기록시 필수)',
    example: 'https://image.example.com/12345.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: '영양제 섭취 데이터 배열',
    type: [SupplementIntakeItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplementIntakeItemDto)
  data: SupplementIntakeItemDto[];
}
