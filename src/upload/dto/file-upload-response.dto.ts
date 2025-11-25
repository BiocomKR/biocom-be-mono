import { ApiProperty } from '@nestjs/swagger';

/**
 * 파일 업로드 응답 DTO
 */
export class FileUploadResponseDto {
  @ApiProperty({
    description: '파일 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '저장된 파일명',
    example: 'file-1705123456789-987654321.jpg',
  })
  filename: string;

  @ApiProperty({
    description: '원본 파일명',
    example: '아침루틴.jpg',
  })
  originalName: string;

  @ApiProperty({
    description: 'MIME 타입',
    example: 'image/jpeg',
  })
  mimeType: string;

  @ApiProperty({
    description: '파일 크기 (bytes)',
    example: 1048576,
  })
  size: number;

  @ApiProperty({
    description: '파일 경로',
    example: '/uploads/file-1705123456789-987654321.jpg',
  })
  path: string;

  @ApiProperty({
    description: '업로드 일시',
    example: '2024-01-13T12:00:00.000Z',
  })
  uploadedAt: Date;
}