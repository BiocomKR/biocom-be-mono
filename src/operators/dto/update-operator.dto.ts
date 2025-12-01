import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsEnum, IsInt, IsBoolean } from 'class-validator';

export class UpdateOperatorDto {
  @ApiPropertyOptional({ description: '비밀번호 (최소 8자)', example: 'newpassword123' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password?: string;

  @ApiPropertyOptional({ description: '이름', example: '홍길동' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '접근 등급',
    enum: ['SYSTEM', 'MANAGER', 'STAFF', 'VIEWER'],
  })
  @IsOptional()
  @IsEnum(['SYSTEM', 'MANAGER', 'STAFF', 'VIEWER'], {
    message: '유효하지 않은 등급입니다.',
  })
  accessTier?: 'SYSTEM' | 'MANAGER' | 'STAFF' | 'VIEWER';

  @ApiPropertyOptional({ description: '부서 ID', example: 1 })
  @IsOptional()
  @IsInt()
  departmentId?: number;

  @ApiPropertyOptional({ description: '활성화 여부', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
