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
  ForbiddenException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { ContentCompletionResponseDto } from './dto/content-completion.dto';
import { getNowKST } from '../common/utils/kst-date.util';
import { PrismaService } from '../common/services/prisma.service';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';

/**
 * 사용자용 컨텐츠 컨트롤러
 * 컨텐츠 조회 및 시청 완료 처리
 */
@ApiTags('컨텐츠')
@Controller('contents')
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly prisma: PrismaService,
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
  @ApiQuery({ name: 'productId', required: false, description: '챌린지 상품 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '강의 목록 조회 성공',
  })
  async getLectures(
    @Request() req: any,
    @Query('week') week?: string,
    @Query('productId') productId?: string
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`강의 목록 조회 요청 - 사용자: ${req.user.sub}, 주차: ${week}, 상품: ${productId}`);

    try {
      const weekNum = week ? parseInt(week, 10) : undefined;
      const productIdNum = productId ? parseInt(productId, 10) : undefined;

      const lectures = await this.contentService.getLectures(req.user.sub, weekNum, productIdNum);

      this.logger.log(`강의 목록 조회 성공 - ${lectures.length}개`);

      return {
        success: true,
        message: '강의 목록이 성공적으로 조회되었습니다.',
        data: lectures,
        timestamp: getNowKST(),
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
        timestamp: getNowKST(),
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error('오늘의 칼럼 조회 실패', error);
      throw error;
    }
  }

  /**
   * 칼럼 상세 조회 (이전글/다음글 포함)
   */
  @Get('columns/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[권장] 칼럼 상세 조회',
    description: '칼럼의 상세 정보를 조회합니다. 이전글/다음글 네비게이션 정보가 포함됩니다.',
  })
  @ApiParam({
    name: 'id',
    description: '칼럼 ID',
    example: 26,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '칼럼 상세 조회 성공',
  })
  async getColumnDetail(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`칼럼 상세 조회 요청 - ID: ${id}, 사용자: ${req.user.sub}`);

    try {
      const column = await this.contentService.getColumnById(id);

      // 비활성화된 칼럼은 노출하지 않음
      if (!column.isActive) {
        this.logger.warn(`비활성화된 칼럼 접근 시도 - ID: ${id}`);
        throw new NotFoundException(`칼럼을 찾을 수 없습니다: ${id}`);
      }

      // 조회수 증가
      await this.contentService.increaseViewCount(id, req.user.sub);

      this.logger.log(`칼럼 상세 조회 성공 - ID: ${id}`);

      return {
        success: true,
        message: '칼럼이 성공적으로 조회되었습니다.',
        data: column,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`칼럼 상세 조회 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 강의 상세 조회 (퀴즈 포함, 구독자/챌린저 체크)
   */
  @Get('lectures/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[권장] 강의 상세 조회',
    description: '강의의 상세 정보를 조회합니다. 연결된 퀴즈 정보가 포함되며, 구독자 또는 활성 챌린지 참여자만 접근할 수 있습니다.',
  })
  @ApiParam({
    name: 'id',
    description: '강의 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '강의 상세 조회 성공',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '접근 권한 없음 (구독자 또는 챌린저만 가능)',
  })
  async getLectureDetail(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`강의 상세 조회 요청 - ID: ${id}, 사용자: ${req.user.sub}`);

    try {
      const lecture = await this.contentService.getLectureById(id);

      // 비활성화된 강의는 노출하지 않음
      if (!lecture.isActive) {
        this.logger.warn(`비활성화된 강의 접근 시도 - ID: ${id}`);
        throw new NotFoundException(`강의를 찾을 수 없습니다: ${id}`);
      }

      // 구독자/챌린저 체크
      const user = await this.prisma.user.findUnique({
        where: { id: req.user.sub },
        select: {
          subscriptionStatus: true,
          userChallenges: {
            where: { status: 'ACTIVE' },
            select: { id: true, activatedAt: true }
          }
        }
      });

      if (!user) {
        throw new ForbiddenException('사용자를 찾을 수 없습니다');
      }

      // 구독자(NEWCOMER 아닌 경우) OR 활성 챌린지 참여자 체크
      const isSubscriber = user.subscriptionStatus === 'SUBSCRIBER';
      const hasActiveChallenge = user.userChallenges.length > 0;

      if (!isSubscriber && !hasActiveChallenge) {
        this.logger.warn(`강의 접근 권한 없음 - 사용자 ID: ${req.user.sub}, 강의 ID: ${id}`);
        throw new ForbiddenException('강의는 구독자 또는 활성 챌린지 참여자만 이용할 수 있습니다');
      }

      // 챌린저의 경우 진행 주차 체크
      let currentDay: number | null = null;
      if (!isSubscriber && hasActiveChallenge) {
        const { calculateChallengeDay } = await import('../common/utils/kst-date.util');
        currentDay = calculateChallengeDay(user.userChallenges[0].activatedAt);
        const allowedWeek = Math.ceil(currentDay / 7);

        // 챌린저는 현재 주차 이하의 강의만 접근 가능
        if (lecture.weekNumber > allowedWeek) {
          this.logger.warn(`강의 접근 제한 - 사용자 ID: ${req.user.sub}, 현재 ${currentDay}일차(${allowedWeek}주차), 요청 강의: ${lecture.weekNumber}주차`);
          throw new ForbiddenException(`아직 접근할 수 없는 강의입니다. 현재 ${allowedWeek}주차까지 이용 가능합니다.`);
        }

        this.logger.log(`챌린저 주차 체크 완료 - 현재: ${currentDay}일차(${allowedWeek}주차), 강의: ${lecture.weekNumber}주차`);
      }

      this.logger.log(`강의 접근 권한 확인 완료 - 사용자 ID: ${req.user.sub}, 구독: ${isSubscriber}, 챌린지: ${hasActiveChallenge}`);

      // 퀴즈는 챌린저의 경우 currentDay와 정확히 일치할 때만 노출
      let lectureData: any = { ...lecture };

      if (!isSubscriber && hasActiveChallenge && currentDay !== null) {
        if (lecture.dayNumber !== currentDay) {
          // 현재 일차와 일치하지 않으면 퀴즈 상태 정보 추가
          lectureData = {
            ...lecture,
            lectureQuizzes: [],
            quizStatus: {
              available: false,
              openDay: lecture.dayNumber,
              message: `${lecture.dayNumber}일차에 오픈됩니다.`
            }
          };
          this.logger.log(`퀴즈 미노출 - 현재 ${currentDay}일차, 강의 ${lecture.dayNumber}일차 (불일치)`);
        } else {
          // 일치하면 퀴즈 이용 가능
          lectureData = {
            ...lecture,
            quizStatus: {
              available: true,
              openDay: lecture.dayNumber,
              message: null
            }
          };
          this.logger.log(`퀴즈 노출 - 현재 ${currentDay}일차, 강의 ${lecture.dayNumber}일차 (일치)`);
        }
      } else if (isSubscriber) {
        // 구독자는 항상 퀴즈 이용 가능
        lectureData = {
          ...lecture,
          quizStatus: {
            available: true,
            openDay: null,
            message: null
          }
        };
      }

      // 조회수 증가
      await this.contentService.increaseViewCount(id, req.user.sub);

      this.logger.log(`강의 상세 조회 성공 - ID: ${id}`);

      return {
        success: true,
        message: '강의가 성공적으로 조회되었습니다.',
        data: lectureData,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`강의 상세 조회 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 컨텐츠 상세 조회 (구버전 - deprecated)
   * @deprecated GET /api/contents/columns/:id 또는 /api/contents/lectures/:id 사용 권장
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Deprecated] 컨텐츠 상세 조회',
    description: '⚠️ Deprecated: GET /api/contents/columns/:id 또는 /api/contents/lectures/:id 사용을 권장합니다.\n\n특정 컨텐츠의 상세 정보를 조회합니다.',
    deprecated: true,
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

      // 강의인 경우 구독자/챌린저 체크
      if (content.type === 'LECTURE') {
        const userId = req.user?.userId || req.user?.id;

        // 사용자 정보 조회
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            subscriptionStatus: true,
            userChallenges: {
              where: { status: 'ACTIVE' },
              select: { id: true }
            }
          }
        });

        if (!user) {
          throw new ForbiddenException('사용자를 찾을 수 없습니다');
        }

        // 구독자(NEWCOMER 아닌 경우) OR 활성 챌린지 참여자 체크
        const isSubscriber = user.subscriptionStatus !== UserSubscriptionStatus.NEWCOMER;
        const hasActiveChallenge = user.userChallenges.length > 0;

        if (!isSubscriber && !hasActiveChallenge) {
          this.logger.warn(`강의 접근 권한 없음 - 사용자 ID: ${userId}, 컨텐츠 ID: ${id}`);
          throw new ForbiddenException('강의는 구독자 또는 활성 챌린지 참여자만 이용할 수 있습니다');
        }

        this.logger.log(`강의 접근 권한 확인 완료 - 사용자 ID: ${userId}, 구독: ${isSubscriber}, 챌린지: ${hasActiveChallenge}`);
      }

      // 조회수 증가
      const userId = req?.user?.userId || req?.user?.id;
      await this.contentService.increaseViewCount(id, userId);

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

  // ❌ DEPRECATED: 2025-10-28 삭제됨
  // 삭제 사유: 포인트 지급은 퀴즈 풀이로 이동
  // - 기존: 컨텐츠 시청 완료 시 포인트 지급
  // - 변경: 강의 연결 퀴즈 풀이 시 포인트 지급 (300점)
  /**
   * 컨텐츠 시청 완료 처리
   * @deprecated 2025-10-28 - 포인트 지급은 퀴즈 풀이로 이동
   */
  // @Post(':id/complete')
  // async completeContent() {
  //   throw new BadRequestException('이 API는 더 이상 사용되지 않습니다. 퀴즈 풀이 API를 사용하세요.');
  // }
}