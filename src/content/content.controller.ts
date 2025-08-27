import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';

/**
 * 사용자용 컨텐츠 조회 컨트롤러
 */
@ApiTags('챌린지-content')
@Controller('content')
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(private readonly contentService: ContentService) {}

  /**
   * 컨텐츠 목록 조회 (페이지네이션)
   */
  @Get()
  @ApiOperation({
    summary: '컨텐츠 목록 조회',
    description: '활성화된 컨텐츠 목록을 페이지네이션하여 조회합니다.',
  })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수', example: 10 })
  @ApiQuery({ name: 'type', required: false, description: '컨텐츠 타입 필터' })
  @ApiQuery({ name: 'category', required: false, description: '카테고리 필터' })
  @ApiQuery({ name: 'search', required: false, description: '검색어 (제목, 설명)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '컨텐츠 목록 조회 성공',
  })
  async getContentList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('사용자 컨텐츠 목록 조회 요청');

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '10', 10);

      const result = await this.contentService.getContentList({
        page: pageNum,
        limit: limitNum,
        type,
        category,
        search,
        isActive: true, // 사용자는 활성화된 컨텐츠만 조회
      });

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
   * 컨텐츠 상세 조회
   */
  @Get(':id')
  @ApiOperation({
    summary: '컨텐츠 상세 조회',
    description: '특정 컨텐츠의 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '컨텐츠 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '컨텐츠 상세 조회 성공',
  })
  async getContentDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`사용자 컨텐츠 상세 조회 요청 - ID: ${id}`);

    try {
      const content = await this.contentService.getContentById(id);
      
      // 비활성화된 컨텐츠는 사용자에게 노출하지 않음
      if (!content.isActive) {
        this.logger.warn(`비활성화된 컨텐츠 접근 시도 - ID: ${id}`);
        throw new NotFoundException(`컨텐츠를 찾을 수 없습니다: ${id}`);
      }

      // 조회수 증가
      await this.contentService.increaseViewCount(id);

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
   * 이벤트별 컨텐츠 목록 조회
   */
  @Get('event/:eventId')
  @ApiOperation({
    summary: '이벤트별 컨텐츠 조회',
    description: '특정 이벤트에 연결된 컨텐츠 목록을 조회합니다.',
  })
  @ApiParam({
    name: 'eventId',
    description: '이벤트 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트별 컨텐츠 조회 성공',
  })
  async getContentByEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트별 컨텐츠 조회 요청 - 이벤트 ID: ${eventId}`);

    try {
      const contents = await this.contentService.getContentsByEventId(eventId);
      
      this.logger.log(`이벤트별 컨텐츠 조회 성공 - 이벤트 ID: ${eventId}, 컨텐츠 수: ${contents.length}`);

      return {
        success: true,
        message: '이벤트별 컨텐츠가 성공적으로 조회되었습니다.',
        data: contents,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트별 컨텐츠 조회 실패 - 이벤트 ID: ${eventId}`, error);
      throw error;
    }
  }

  /**
   * 인기 컨텐츠 목록 조회
   */
  @Get('popular/list')
  @ApiOperation({
    summary: '인기 컨텐츠 조회',
    description: '조회수가 높은 인기 컨텐츠 목록을 조회합니다.',
  })
  @ApiQuery({ name: 'limit', required: false, description: '조회할 개수', example: 5 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '인기 컨텐츠 조회 성공',
  })
  async getPopularContents(
    @Query('limit') limit?: string,
  ): Promise<ApiResponseDto<any>> {
    const limitNum = parseInt(limit || '5', 10);
    
    this.logger.log(`인기 컨텐츠 조회 요청 - 개수: ${limitNum}`);

    try {
      const contents = await this.contentService.getPopularContents(limitNum);
      
      this.logger.log(`인기 컨텐츠 조회 성공 - 조회된 개수: ${contents.length}`);

      return {
        success: true,
        message: '인기 컨텐츠가 성공적으로 조회되었습니다.',
        data: contents,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('인기 컨텐츠 조회 실패', error);
      throw error;
    }
  }
}