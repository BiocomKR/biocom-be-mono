import { ApiProperty } from '@nestjs/swagger';

/**
 * 영양제 복용 정보 DTO
 */
export class DosageDto {
  @ApiProperty({
    description: '1일 복용 횟수',
    example: 2,
  })
  frequency: number;

  @ApiProperty({
    description: '1회 복용량',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: '복용 단위',
    example: '정',
  })
  unit: string;
}

/**
 * 내 영양제 루틴 응답 DTO
 */
export class SupplementRoutineResponseDto {
  @ApiProperty({
    description: '루틴 ID',
    example: 1,
  })
  routineId: number;

  @ApiProperty({
    description: '상품 ID',
    example: 123,
  })
  productId: number;

  @ApiProperty({
    description: '영양제명',
    example: '종근당 비타민C',
  })
  productName: string;

  @ApiProperty({
    description: '영양제 이미지 URL',
    example: 'https://storage.googleapis.com/...',
    nullable: true,
  })
  productImage: string | null;

  @ApiProperty({
    description: '복용 정보',
    type: DosageDto,
  })
  dosage: DosageDto;

  @ApiProperty({
    description: '기본 영양제 여부 (온보딩 시 자동 추가된 3종)',
    example: true,
  })
  isDefault: boolean;

  @ApiProperty({
    description: '노출 순서',
    example: 1,
  })
  displayOrder: number;

  @ApiProperty({
    description: '아침 섭취 여부 (당일 기록)',
    example: true,
  })
  morning: boolean;

  @ApiProperty({
    description: '점심 섭취 여부 (당일 기록)',
    example: false,
  })
  afternoon: boolean;

  @ApiProperty({
    description: '저녁 섭취 여부 (당일 기록)',
    example: true,
  })
  evening: boolean;
}
