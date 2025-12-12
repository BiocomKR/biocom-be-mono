import { IsInt, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 프로필 이미지 설정 DTO
 */
export class SetProfileImageDto {
  @ApiProperty({ description: '파일 ID (files 테이블의 id)' })
  @IsInt()
  @IsPositive()
  fileId: number;
}

/**
 * 프로필 이미지 응답 DTO
 */
export class ProfileImageResponseDto {
  @ApiPropertyOptional({ description: 'UserFile ID' })
  id: number | null;

  @ApiPropertyOptional({ description: '파일 ID' })
  fileId: number | null;

  @ApiPropertyOptional({ description: '파일 경로 (URL)' })
  filePath: string | null;

  @ApiPropertyOptional({ description: '원본 파일명' })
  originalName: string | null;

  @ApiPropertyOptional({ description: '업로드 일시' })
  uploadedAt: Date | null;
}
