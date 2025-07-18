import { 
  Controller, 
  Post, 
  Get, 
  Delete,
  Param,
  Query,
  Req, 
  UseInterceptors, 
  UploadedFile,
  ParseIntPipe,
  HttpStatus,
  Logger,
  BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery as ApiQueryDecorator
} from '@nestjs/swagger';
import { Express } from 'express';
import { UploadService } from './upload.service';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { ApiSuccessResponse } from '../common/dto/api-response.dto';

/**
 * 파일 업로드 컨트롤러
 * 활동 기록과 연관된 이미지 파일 업로드 API
 */
@ApiTags('upload')
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  /**
   * 이미지 파일 업로드
   */
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ 
    summary: '이미지 파일 업로드', 
    description: '활동 기록과 연관된 이미지 파일을 업로드합니다.' 
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '업로드할 이미지 파일',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: '파일 업로드 성공',
    type: ApiSuccessResponse
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: '잘못된 파일 형식 또는 크기' 
  })
  @ApiQueryDecorator({ 
    name: 'email', 
    required: true, 
    description: '사용자 이메일' 
  })
  @ApiQueryDecorator({ 
    name: 'relatedType', 
    required: true, 
    description: '연관된 활동 타입 (예: DIET, DAILY_MISSION, SUPPLEMENT)',
    example: 'DIET'
  })
  async uploadImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('email') email: string,
    @Query('relatedType') relatedType: string
  ): Promise<ApiSuccessResponse<FileUploadResponseDto>> {
    if (!file) {
      throw new BadRequestException('파일이 업로드되지 않았습니다.');
    }

    if (!relatedType) {
      throw new BadRequestException('연관된 활동 타입(relatedType)을 지정해주세요.');
    }

    this.logger.log(`이미지 업로드 요청 - 사용자: ${req.userId}, 파일: ${file.originalname}, 타입: ${relatedType}`);

    const uploadedFile = await this.uploadService.uploadImage(
      req.userId,
      file,
      relatedType
    );

    return {
      success: true,
      message: '이미지가 성공적으로 업로드되었습니다.',
      data: uploadedFile,
      timestamp: new Date(),
    };
  }

  /**
   * 파일 정보 조회
   */
  @Get(':id')
  @ApiOperation({ 
    summary: '파일 정보 조회', 
    description: '특정 파일의 정보를 조회합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '파일 ID',
    example: 1 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '파일 정보 조회 성공',
    type: ApiSuccessResponse
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: '파일을 찾을 수 없음' 
  })
  @ApiQueryDecorator({ 
    name: 'email', 
    required: true, 
    description: '사용자 이메일' 
  })
  async getFileInfo(
    @Param('id', ParseIntPipe) id: number,
    @Query('email') email: string
  ): Promise<ApiSuccessResponse<FileUploadResponseDto>> {
    this.logger.log(`파일 정보 조회 요청 - ID: ${id}`);

    const file = await this.uploadService.getFileInfo(id);

    return {
      success: true,
      message: '파일 정보가 성공적으로 조회되었습니다.',
      data: file,
      timestamp: new Date(),
    };
  }

  /**
   * 사용자의 업로드 파일 목록 조회
   */
  @Get()
  @ApiOperation({ 
    summary: '업로드 파일 목록 조회', 
    description: '현재 사용자의 업로드된 파일 목록을 조회합니다.' 
  })
  @ApiQueryDecorator({ 
    name: 'relatedType', 
    required: false,
    description: '연관된 활동 타입으로 필터링',
    example: 'DIET' 
  })
  @ApiQueryDecorator({ 
    name: 'email', 
    required: true, 
    description: '사용자 이메일' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '파일 목록 조회 성공',
    type: ApiSuccessResponse
  })
  async getUserFiles(
    @Req() req: any,
    @Query('email') email: string,
    @Query('relatedType') relatedType?: string
  ): Promise<ApiSuccessResponse<FileUploadResponseDto[]>> {
    this.logger.log(`사용자 파일 목록 조회 요청 - 사용자: ${req.userId}, 타입: ${relatedType || '전체'}`);

    const files = await this.uploadService.getUserFiles(
      req.userId,
      relatedType
    );

    return {
      success: true,
      message: '파일 목록이 성공적으로 조회되었습니다.',
      data: files,
      timestamp: new Date(),
    };
  }

  /**
   * 파일 삭제
   */
  @Delete(':id')
  @ApiOperation({ 
    summary: '파일 삭제', 
    description: '업로드된 파일을 삭제합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '삭제할 파일 ID',
    example: 1 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '파일 삭제 성공',
    type: ApiSuccessResponse
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: '파일을 찾을 수 없거나 삭제 권한 없음' 
  })
  @ApiQueryDecorator({ 
    name: 'email', 
    required: true, 
    description: '사용자 이메일' 
  })
  async deleteFile(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Query('email') email: string
  ): Promise<ApiSuccessResponse<void>> {
    this.logger.log(`파일 삭제 요청 - 사용자: ${req.userId}, ID: ${id}`);

    await this.uploadService.deleteFile(id, req.userId);

    return {
      success: true,
      message: '파일이 성공적으로 삭제되었습니다.',
      timestamp: new Date(),
    };
  }
}