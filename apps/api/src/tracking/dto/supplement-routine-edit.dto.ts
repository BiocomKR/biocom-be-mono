import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber } from 'class-validator';

/**
 * 루틴 편집 화면 영양제 목록 응답 DTO
 */
export class SupplementRoutineEditItemDto {
  @ApiProperty({ description: '상품 ID', example: 4 })
  productId: number;

  @ApiProperty({ description: '영양제명', example: '풍성밸런스' })
  productName: string;

  @ApiProperty({ description: '영양제 이미지 URL', nullable: true })
  productImage: string | null;

  @ApiProperty({
    description: '복용 정보',
    example: { frequency: 3, quantity: 1, unit: '정' },
  })
  dosage: {
    frequency: number;
    quantity: number;
    unit: string;
  };

  @ApiProperty({
    description: '내 루틴에 포함 여부 (체크박스 상태)',
    example: true,
  })
  isInMyRoutine: boolean;

  @ApiProperty({
    description: '기본 영양제 여부 (수정 불가)',
    example: true,
  })
  isDefault: boolean;

  @ApiProperty({
    description: '정렬 그룹 (1: 내루틴, 2: 메타드림/리셋데이, 3: 나머지)',
    example: 1,
  })
  groupOrder: number;
}

/**
 * 영양제 루틴 저장 요청 DTO
 */
export class SaveSupplementRoutineDto {
  @ApiProperty({
    description: '루틴에 추가할 영양제 상품 ID 배열 (사용자 추가 영양제만, 기본 영양제는 자동 유지)',
    example: [5, 7, 9],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  productIds: number[];
}
