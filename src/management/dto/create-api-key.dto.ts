import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * API Key 생성 DTO
 * 새로운 API Key를 생성할 때 필요한 정보
 */
export class CreateApiKeyDto {
  /**
   * API Key 식별 이름
   * 백오피스에서 구분하기 위한 이름
   */
  @ApiProperty({
    description: 'API Key 식별 이름',
    example: '프로덕션 백오피스',
    minLength: 2,
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'API Key 이름은 필수입니다.' })
  @IsString({ message: 'API Key 이름은 문자열이어야 합니다.' })
  @MinLength(2, { message: 'API Key 이름은 최소 2자 이상이어야 합니다.' })
  @MaxLength(50, { message: 'API Key 이름은 최대 50자까지 가능합니다.' })
  name: string;

  /**
   * API Key 설명
   * 용도나 사용처에 대한 상세 설명 (선택사항)
   */
  @ApiProperty({
    description: 'API Key 용도 설명',
    example: '프로덕션 환경 백오피스에서 사용하는 API Key',
    required: false,
    maxLength: 200,
  })
  @IsOptional()
  @IsString({ message: 'API Key 설명은 문자열이어야 합니다.' })
  @MaxLength(200, { message: 'API Key 설명은 최대 200자까지 가능합니다.' })
  description?: string;
}