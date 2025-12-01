import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsInt } from 'class-validator';

export class CreateOperatorDto {
  @ApiProperty({ description: '이메일', example: 'operator@biocom.com' })
  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다.' })
  email: string;

  @ApiProperty({ description: '비밀번호 (최소 8자)', example: 'password123' })
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password: string;

  @ApiProperty({ description: '이름', example: '홍길동' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: '접근 등급',
    enum: ['SYSTEM', 'MANAGER', 'STAFF', 'VIEWER'],
    default: 'VIEWER',
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
}
