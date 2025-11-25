import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, ValidateNested } from 'class-validator';

export class ConsentItemDto {
  @ApiProperty({ description: '약관 ID', example: 1 })
  @IsInt()
  consentId: number;

  @ApiProperty({ description: '동의 여부', example: true })
  @IsBoolean()
  isAgreed: boolean;
}

export class UpdateUserConsentsDto {
  @ApiProperty({
    description: '약관 동의 목록',
    type: [ConsentItemDto],
    example: [
      { consentId: 1, isAgreed: true },
      { consentId: 2, isAgreed: true },
      { consentId: 3, isAgreed: true },
      { consentId: 4, isAgreed: false },
      { consentId: 5, isAgreed: false },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentItemDto)
  consents: ConsentItemDto[];
}
