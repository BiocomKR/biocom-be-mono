import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Min, Max, IsOptional } from 'class-validator';

export const SUPPORTED_INPUT_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff', 'avif'] as const;
export const SUPPORTED_OUTPUT_FORMATS = ['png', 'jpg', 'webp', 'avif'] as const;

export type InputFormat = typeof SUPPORTED_INPUT_FORMATS[number];
export type OutputFormat = typeof SUPPORTED_OUTPUT_FORMATS[number];

export class ImageConvertDto {
  @ApiProperty({
    description: '출력 포맷',
    enum: SUPPORTED_OUTPUT_FORMATS,
    example: 'webp',
  })
  @IsIn(SUPPORTED_OUTPUT_FORMATS, {
    message: `지원하는 출력 포맷: ${SUPPORTED_OUTPUT_FORMATS.join(', ')}`,
  })
  outputFormat: OutputFormat;

  @ApiProperty({
    description: '이미지 품질 (1-100)',
    example: 80,
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quality?: number;
}

export class ImageConvertResponseDto {
  @ApiProperty({ description: '원본 파일명' })
  originalName: string;

  @ApiProperty({ description: '변환된 파일명' })
  convertedName: string;

  @ApiProperty({ description: '원본 파일 크기 (bytes)' })
  originalSize: number;

  @ApiProperty({ description: '변환된 파일 크기 (bytes)' })
  convertedSize: number;

  @ApiProperty({ description: '압축률 (%)' })
  compressionRatio: number;
}
