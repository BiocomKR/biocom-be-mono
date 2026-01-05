import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreateAccountDeletionDto {
  @ApiProperty({
    description: '가입 시 사용한 휴대폰 번호 (하이픈 없이)',
    example: '01012345678',
  })
  @IsString()
  @IsNotEmpty({ message: '휴대폰 번호를 입력해주세요.' })
  @Matches(/^01[016789][0-9]{7,8}$/, { message: '올바른 휴대폰 번호 형식이 아닙니다.' })
  mobile: string;

  @ApiPropertyOptional({
    description: '삭제 요청 사유 (선택)',
    example: '더 이상 서비스를 이용하지 않습니다.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
