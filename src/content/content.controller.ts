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
  Logger,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContentService, ContentType, ContentFileDto } from './content.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * Management 컨텐츠 관리 컨트롤러
 * 백오피스에서 컨텐츠를 관리하는 API
 */
@Controller('management/content')
@UseGuards(JwtAuthGuard)
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(private readonly contentService: ContentService) {}

  /**
   * 컨텐츠 목록 조회 (페이징)
   */
  @Get()
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
        timestamp: getNowKST(),
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
  async createContent(
    @Body() createDto: {
      title: string;
      content: string;
      type: ContentType;
      isActive?: boolean;
    },
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`컨텐츠 생성 요청 - 제목: ${createDto.title}`);

    try {
      const contentFiles: ContentFileDto[] = files?.map((file, index) => ({
        fileUrl: `/uploads/${file.filename}`,
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
        timestamp: getNowKST(),
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
  async getContent(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto<any>> {
    this.logger.log(`컨텐츠 상세 조회 요청 - ID: ${id}`);

    try {
      const content = await this.contentService.getContentById(id);

      this.logger.log(`컨텐츠 상세 조회 성공 - ID: ${id}`);

      return {
        success: true,
        message: '컨텐츠가 성공적으로 조회되었습니다.',
        data: content,
        timestamp: getNowKST(),
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
  async updateContent(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: Partial<{
      title: string;
      content: string;
      type: ContentType;
      isActive: boolean;
    }>,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`컨텐츠 수정 요청 - ID: ${id}`);

    try {
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
        timestamp: getNowKST(),
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
  async deleteContent(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto<null>> {
    this.logger.log(`컨텐츠 삭제 요청 - ID: ${id}`);

    try {
      await this.contentService.deleteContent(id);

      this.logger.log(`컨텐츠 삭제 성공 - ID: ${id}`);

      return {
        success: true,
        message: '컨텐츠가 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`컨텐츠 삭제 실패 - ID: ${id}`, error);
      throw error;
    }
  }
}
