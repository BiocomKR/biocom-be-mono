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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsentService, CreateConsentDto, UpdateConsentDto } from './consent.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * Management 약관 관리 컨트롤러
 * 백오피스에서 약관을 관리하는 API
 */
@Controller('management/consents')
@UseGuards(JwtAuthGuard)
export class ConsentController {
  private readonly logger = new Logger(ConsentController.name);

  constructor(private readonly consentService: ConsentService) {}

  /**
   * 약관 목록 조회 (페이징)
   */
  @Get()
  async getConsents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('code') code?: string,
    @Query('isActive') isActive?: string,
    @Query('isRequired') isRequired?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('약관 목록 조회 요청');

    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);

    const filters = {
      search,
      code,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isRequired: isRequired === 'true' ? true : isRequired === 'false' ? false : undefined,
      includeDeleted: includeDeleted === 'true',
    };

    const sort = {
      sortBy: sortBy || 'displayOrder',
      sortOrder: (sortOrder || 'asc') as 'asc' | 'desc',
    };

    const result = await this.consentService.getConsentsWithPagination(
      pageNum,
      limitNum,
      filters,
      sort,
    );

    this.logger.log(`약관 목록 조회 성공 - 총 ${result.pagination.total}개`);

    return {
      success: true,
      message: '약관 목록이 조회되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 약관 동의 현황 통계 조회
   * NOTE: :id 라우트보다 먼저 정의해야 함
   */
  @Get('statistics/summary')
  async getConsentStatistics(): Promise<ApiResponseDto<any>> {
    this.logger.log('약관 동의 현황 통계 조회');

    const result = await this.consentService.getConsentStatistics();

    return {
      success: true,
      message: '약관 동의 현황이 조회되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 약관 동의 목록 조회 (페이징)
   * NOTE: :id 라우트보다 먼저 정의해야 함
   */
  @Get('agreements')
  async getUserConsents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('consentId') consentId?: string,
    @Query('isAgreed') isAgreed?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('약관 동의 목록 조회');

    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);

    const filters = {
      search,
      consentId: consentId ? parseInt(consentId, 10) : undefined,
      isAgreed: isAgreed === 'true' ? true : isAgreed === 'false' ? false : undefined,
      startDate,
      endDate,
    };

    const sort = {
      sortBy: sortBy || 'agreedAt',
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
    };

    const result = await this.consentService.getUserConsentsWithPagination(
      pageNum,
      limitNum,
      filters,
      sort,
    );

    return {
      success: true,
      message: '약관 동의 목록이 조회되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 특정 약관의 버전 목록 조회
   * NOTE: :id 라우트보다 먼저 정의해야 함
   */
  @Get('code/:code/versions')
  async getConsentVersions(
    @Param('code') code: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`약관 버전 목록 조회: ${code}`);

    const versions = await this.consentService.getConsentVersions(code);

    return {
      success: true,
      message: '약관 버전 목록이 조회되었습니다.',
      data: versions,
      timestamp: getNowKST(),
    };
  }

  /**
   * 약관 상세 조회
   */
  @Get(':id')
  async getConsent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`약관 상세 조회: ID ${id}`);

    const consent = await this.consentService.getConsentById(id);

    return {
      success: true,
      message: '약관이 조회되었습니다.',
      data: consent,
      timestamp: getNowKST(),
    };
  }

  /**
   * 약관 생성
   */
  @Post()
  async createConsent(
    @Body() dto: CreateConsentDto,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`약관 생성: ${dto.code} v${dto.version}`);

    const consent = await this.consentService.createConsent(dto);

    return {
      success: true,
      message: '약관이 생성되었습니다.',
      data: consent,
      timestamp: getNowKST(),
    };
  }

  /**
   * 약관 수정
   */
  @Put(':id')
  async updateConsent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConsentDto,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`약관 수정: ID ${id}`);

    const consent = await this.consentService.updateConsent(id, dto);

    return {
      success: true,
      message: '약관이 수정되었습니다.',
      data: consent,
      timestamp: getNowKST(),
    };
  }

  /**
   * 약관 삭제 (soft delete)
   */
  @Delete(':id')
  async deleteConsent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`약관 삭제: ID ${id}`);

    const result = await this.consentService.deleteConsent(id);

    return {
      success: true,
      message: result.message,
      data: null,
      timestamp: getNowKST(),
    };
  }

  /**
   * 약관 버전 활성화
   */
  @Post(':id/activate')
  async activateConsent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`약관 활성화: ID ${id}`);

    const consent = await this.consentService.activateConsent(id);

    return {
      success: true,
      message: '약관이 활성화되었습니다.',
      data: consent,
      timestamp: getNowKST(),
    };
  }

  /**
   * 새 버전 생성 (기존 버전 복제)
   */
  @Post(':id/new-version')
  async createNewVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body('version') version: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`약관 새 버전 생성: ID ${id} -> v${version}`);

    const consent = await this.consentService.createNewVersion(id, version);

    return {
      success: true,
      message: '새 버전이 생성되었습니다.',
      data: consent,
      timestamp: getNowKST(),
    };
  }
}
