import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Query,
  HttpStatus,
  Logger,
  NotFoundException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { ContentCompletionResponseDto } from './dto/content-completion.dto';

/**
 * 사용자용 컨텐츠 컨트롤러
 * 컨텐츠 조회 및 시청 완료 처리
 */
@ApiTags('챌린지-컨텐츠')
@Controller('contents')
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(
    private readonly contentService: ContentService,
  ) {}

  /**
   * 강의 목록 조회 (주차별, 사용자 상태별)
   */
  @Get('lectures')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '강의 목록 조회',
    description: '사용자 상태(챌린지/구독)에 따라 강의 목록을 조회합니다.',
  })
  @ApiQuery({ name: 'week', required: false, description: '주차 (1,2,3)', example: 1 })
  @ApiQuery({ name: 'challengeId', required: false, description: '챌린지 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '강의 목록 조회 성공',
  })
  async getLectures(
    @Request() req: any,
    @Query('week') week?: string,
    @Query('challengeId') challengeId?: string
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`강의 목록 조회 요청 - 사용자: ${req.user.userId}, 주차: ${week}`);

    try {
      const weekNum = week ? parseInt(week, 10) : undefined;
      const challengeIdNum = challengeId ? parseInt(challengeId, 10) : undefined;

      const result = await this.contentService.getLectures(req.user.userId, weekNum, challengeIdNum);

      this.logger.log(`강의 목록 조회 성공 - ${result.lectures.length}개`);

      return {
        success: true,
        message: '강의 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('강의 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 칼럼 목록 조회 (검색, 정렬, 페이징)
   */
  @Get('columns')
  @ApiOperation({
    summary: '칼럼 목록 조회',
    description: '칼럼 목록을 검색, 정렬, 페이징하여 조회합니다.',
  })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수', example: 10 })
  @ApiQuery({ name: 'search', required: false, description: '검색어 (제목, 내용)' })
  @ApiQuery({ name: 'sort', required: false, description: '정렬 (popular: 인기순, latest: 최신순)', example: 'popular' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '칼럼 목록 조회 성공',
  })
  async getColumns(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`칼럼 목록 조회 요청 - 검색: ${search}, 정렬: ${sort}`);

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '10', 10);

      const result = await this.contentService.getColumns({
        page: pageNum,
        limit: limitNum,
        search,
        sort: sort as 'popular' | 'latest'
      });

      this.logger.log(`칼럼 목록 조회 성공 - 총 ${result.total}개`);

      return {
        success: true,
        message: '칼럼 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('칼럼 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 오늘의 칼럼 조회 (최신 5개)
   */
  @Get('columns/today')
  @ApiOperation({
    summary: '오늘의 칼럼 조회',
    description: '최신 칼럼 5개를 조회합니다 (롤링 배너용).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '오늘의 칼럼 조회 성공',
  })
  async getTodayColumns(): Promise<ApiResponseDto<any>> {
    this.logger.log('오늘의 칼럼 조회 요청');

    try {
      const columns = await this.contentService.getTodayColumns();

      this.logger.log(`오늘의 칼럼 조회 성공 - ${columns.length}개`);

      return {
        success: true,
        message: '오늘의 칼럼이 성공적으로 조회되었습니다.',
        data: columns,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('오늘의 칼럼 조회 실패', error);
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
    @Request() req?: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`사용자 컨텐츠 상세 조회 요청 - ID: ${id}`);

    try {
      const content = await this.contentService.getContentById(id);
      
      // 비활성화된 컨텐츠는 사용자에게 노출하지 않음
      if (!content.isActive) {
        this.logger.warn(`비활성화된 컨텐츠 접근 시도 - ID: ${id}`);
        throw new NotFoundException(`컨텐츠를 찾을 수 없습니다: ${id}`);
      }

      // 조회수 증가 (로그인된 사용자의 경우 중복 방지)
      const userId = req?.user?.userId;
      await this.contentService.increaseViewCount(id, userId);

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

  /**
   * 컨텐츠 시청 완료 처리
   * @description 컨텐츠를 시청 완료하고 최초 1회에 한해 보상 포인트를 지급합니다
   */
  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '컨텐츠 시청 완료',
    description: '컨텐츠 시청을 완료 처리합니다. 최초 시청 시에만 보상 포인트가 지급됩니다.'
  })
  @ApiParam({
    name: 'id',
    description: '컨텐츠 ID',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: '컨텐츠 시청 완료 성공',
    type: ContentCompletionResponseDto
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청'
  })
  @ApiResponse({
    status: 404,
    description: '컨텐츠를 찾을 수 없음'
  })
  async completeContent(
    @Param('id', ParseIntPipe) contentId: number,
    @Request() req: any
  ) {
    this.logger.log(`컨텐츠 시청 완료 요청 - 사용자: ${req.user.userId}, 컨텐츠: ${contentId}`);

    try {
      const result = await this.contentService.completeContent(req.user.userId, contentId);
      
      this.logger.log(`컨텐츠 시청 완료 성공 - 사용자: ${req.user.userId}, 컨텐츠: ${contentId}`);
      
      return result;
    } catch (error) {
      this.logger.error(`컨텐츠 시청 완료 실패 - 사용자: ${req.user.userId}, 컨텐츠: ${contentId}`, error);
      throw error;
    }
  }
}