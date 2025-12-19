import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Body,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UtilsService, FileUploadResult } from './utils.service';
import {
  ImageConvertDto,
  SUPPORTED_INPUT_FORMATS,
  SUPPORTED_OUTPUT_FORMATS,
} from './dto/image-convert.dto';
import * as archiver from 'archiver';
import { getNowKST } from '../common/utils/kst-date.util';

@ApiTags('유틸리티')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('utils')
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}

  @Post('convert-images')
  @UseInterceptors(FilesInterceptor('files', 50))
  @ApiOperation({
    summary: '이미지 포맷 변환',
    description: `여러 이미지를 원하는 포맷으로 변환합니다.

지원 입력 포맷: ${SUPPORTED_INPUT_FORMATS.join(', ')}
지원 출력 포맷: ${SUPPORTED_OUTPUT_FORMATS.join(', ')}
최대 파일 수: 50개
최대 파일 크기: 10MB/파일`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files', 'outputFormat'],
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: '변환할 이미지 파일들 (최대 50개)',
        },
        outputFormat: {
          type: 'string',
          enum: [...SUPPORTED_OUTPUT_FORMATS],
          description: '출력 포맷',
        },
        quality: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 80,
          description: '이미지 품질 (1-100)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '변환된 이미지 ZIP 파일',
    content: {
      'application/zip': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async convertImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: ImageConvertDto,
    @Res() res: Response,
  ): Promise<void> {
    if (!files || files.length === 0) {
      throw new BadRequestException('파일을 업로드해주세요');
    }

    const quality = dto.quality || 80;
    const { results, buffers } = await this.utilsService.convertImages(
      files,
      dto.outputFormat,
      quality,
    );

    // 단일 파일인 경우 직접 반환
    if (files.length === 1) {
      const contentType = this.getContentType(dto.outputFormat);
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(results[0].convertedName)}"`,
      );
      res.setHeader('X-Original-Size', results[0].originalSize.toString());
      res.setHeader('X-Converted-Size', results[0].convertedSize.toString());
      res.setHeader(
        'X-Compression-Ratio',
        results[0].compressionRatio.toString(),
      );
      res.send(buffers[0]);
      return;
    }

    // 여러 파일인 경우 ZIP으로 압축
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="converted_images_${Date.now()}.zip"`,
    );
    res.setHeader('X-Conversion-Results', JSON.stringify(results));

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (let i = 0; i < buffers.length; i++) {
      archive.append(buffers[i], { name: results[i].convertedName });
    }

    await archive.finalize();
  }

  private getContentType(format: string): string {
    switch (format) {
      case 'webp':
        return 'image/webp';
      case 'avif':
        return 'image/avif';
      case 'png':
        return 'image/png';
      case 'jpg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream';
    }
  }

  @Post('upload-files')
  @UseInterceptors(FilesInterceptor('files', 50))
  @ApiOperation({
    summary: '파일 업로드 (GCS)',
    description: '파일을 Google Cloud Storage에 업로드하고 URL을 반환합니다. 최대 50개, 파일당 10MB',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: '업로드할 파일들 (최대 50개)',
        },
        folder: {
          type: 'string',
          description: '저장할 폴더 경로 (선택)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '업로드 성공' })
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ): Promise<{ success: boolean; data: FileUploadResult[]; timestamp: Date }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('파일을 업로드해주세요');
    }

    const results = await this.utilsService.uploadFiles(files, folder);

    return {
      success: true,
      data: results,
      timestamp: getNowKST(),
    };
  }

  @Delete('delete-file')
  @ApiOperation({
    summary: '파일 삭제 (URL로 삭제)',
    description: 'GCS 파일 URL을 입력하면 해당 파일을 삭제합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: {
          type: 'string',
          description: '삭제할 파일의 GCS URL',
          example: 'https://storage.googleapis.com/api-dev-biocom-uploads/example.png',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteFile(
    @Body('url') url: string,
  ): Promise<{ success: boolean; message: string; timestamp: Date }> {
    if (!url) {
      throw new BadRequestException('삭제할 파일 URL을 입력해주세요');
    }

    await this.utilsService.deleteFileByUrl(url);

    return {
      success: true,
      message: '파일이 삭제되었습니다',
      timestamp: getNowKST(),
    };
  }
}
