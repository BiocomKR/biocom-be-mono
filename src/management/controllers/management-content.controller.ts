import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
  Logger,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ContentService } from '../../content/content.service';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { ContentType, ContentFileDto } from '../../content/content.types';

/**
 * Management 컨텐츠 관리 컨트롤러
 * 백오피스에서 컨텐츠를 관리하는 API
 */
@ApiTags('management-content')
@Controller('management/content')
@UseGuards(ApiKeyGuard)
@ApiHeader({
  name: 'X-API-KEY',
  description: 'API Key for authentication',
  required: true,
})
export class ManagementContentController {
  private readonly logger = new Logger(ManagementContentController.name);

  constructor(private readonly contentService: ContentService) {}

  /**
   * 컨텐츠 목록 조회 (페이징)
   */
  @Get()
  @ApiOperation({
    summary: '컨텐츠 목록 조회',
    description: '컨텐츠 목록을 페이징 처리하여 조회합니다.',
  })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호 (기본값: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수 (기본값: 20)', example: 20 })
  @ApiQuery({ name: 'search', required: false, description: '검색어 (제목, 내용)' })
  @ApiQuery({ name: 'type', required: false, description: '컨텐츠 타입', enum: ContentType })
  @ApiQuery({ name: 'isActive', required: false, description: '활성화 상태', type: 'boolean' })
  @ApiQuery({ name: 'sortBy', required: false, description: '정렬 기준', enum: ['createdAt', 'title', 'type'] })
  @ApiQuery({ name: 'sortOrder', required: false, description: '정렬 순서', enum: ['asc', 'desc'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '컨텐츠 목록 조회 성공',
  })
  async getContents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('컨텐츠 목록 조회 요청');

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      const filters = {
        search,
        type,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      };

      const sort = {
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      };

      const result = await this.contentService.getContentsWithPagination(
        pageNum,
        limitNum,
        filters,
        sort
      );

      this.logger.log(`컨텐츠 목록 조회 성공 - 총 ${result.total}개`);

      return {
        success: true,
        message: '컨텐츠 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('컨텐츠 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 새로운 컨텐츠 생성
   */
  @Post()
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({
    summary: '컨텐츠 생성',
    description: '새로운 컨텐츠를 생성합니다.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '컨텐츠 제목',
          example: '건강한 수면을 위한 10가지 팁',
        },
        content: {
          type: 'string',
          description: 'HTML 컨텐츠',
          example: '<h1>건강한 수면</h1><p>충분한 수면은...</p>',
        },
        type: {
          type: 'string',
          description: '컨텐츠 타입',
          enum: Object.values(ContentType),
          example: ContentType.TIP,
        },
        isActive: {
          type: 'boolean',
          description: '활성화 여부',
          example: true,
        },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: '첨부 파일 (이미지)',
        },
      },
      required: ['title', 'content'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '컨텐츠 생성 성공',
  })
  async createContent(
    @Body() createDto: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`컨텐츠 생성 요청 - 제목: ${createDto.title}`);

    try {
      // 파일 처리 (실제 구현 시 S3 업로드 등 필요)
      const contentFiles: ContentFileDto[] = files?.map((file, index) => ({
        fileUrl: `/uploads/${file.filename}`, // 실제로는 S3 URL
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        sortOrder: index,
      })) || [];

      const content = await this.contentService.createContent(createDto, contentFiles);

      this.logger.log(`컨텐츠 생성 성공 - ID: ${content.id}`);

      return {
        success: true,
        message: '컨텐츠가 성공적으로 생성되었습니다.',
        data: content,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`컨텐츠 생성 실패 - 제목: ${createDto.title}`, error);
      throw error;
    }
  }

  /**
   * 컨텐츠 상세 조회
   */
  @Get(':id')
  @ApiOperation({
    summary: '컨텐츠 상세 조회',
    description: '특정 컨텐츠의 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '컨텐츠 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '컨텐츠 조회 성공',
  })
  async getContent(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto<any>> {
    this.logger.log(`컨텐츠 상세 조회 요청 - ID: ${id}`);

    try {
      const content = await this.contentService.getContentById(id);

      this.logger.log(`컨텐츠 상세 조회 성공 - ID: ${id}`);

      return {
        success: true,
        message: '컨텐츠가 성공적으로 조회되었습니다.',
        data: content,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`컨텐츠 상세 조회 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 컨텐츠 수정
   */
  @Put(':id')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({
    summary: '컨텐츠 수정',
    description: '기존 컨텐츠를 수정합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '컨텐츠 ID',
    example: 1,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '컨텐츠 제목',
        },
        content: {
          type: 'string',
          description: 'HTML 컨텐츠',
        },
        type: {
          type: 'string',
          description: '컨텐츠 타입',
          enum: Object.values(ContentType),
        },
        isActive: {
          type: 'boolean',
          description: '활성화 여부',
        },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: '첨부 파일 (이미지)',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '컨텐츠 수정 성공',
  })
  async updateContent(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`컨텐츠 수정 요청 - ID: ${id}`);

    try {
      // 파일 처리
      const contentFiles: ContentFileDto[] = files?.map((file, index) => ({
        fileUrl: `/uploads/${file.filename}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        sortOrder: index,
      })) || [];

      const content = await this.contentService.updateContent(id, updateDto, contentFiles);

      this.logger.log(`컨텐츠 수정 성공 - ID: ${id}`);

      return {
        success: true,
        message: '컨텐츠가 성공적으로 수정되었습니다.',
        data: content,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`컨텐츠 수정 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 컨텐츠 삭제
   */
  @Delete(':id')
  @ApiOperation({
    summary: '컨텐츠 삭제',
    description: '컨텐츠를 삭제합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '컨텐츠 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '컨텐츠 삭제 성공',
  })
  async deleteContent(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto<null>> {
    this.logger.log(`컨텐츠 삭제 요청 - ID: ${id}`);

    try {
      await this.contentService.deleteContent(id);

      this.logger.log(`컨텐츠 삭제 성공 - ID: ${id}`);

      return {
        success: true,
        message: '컨텐츠가 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`컨텐츠 삭제 실패 - ID: ${id}`, error);
      throw error;
    }
  }
}