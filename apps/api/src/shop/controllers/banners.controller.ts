import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { BannersService } from '../services/banners.service';
import { BannerDto } from '../dto/banner.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/**
 * 배너 컨트롤러
 * 배너 조회 API 제공
 */
@ApiTags('배너')
@Controller('shop/banners')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  /**
   * 활성 배너 목록 조회
   * GET /shop/banners
   *
   * @param bannerType 배너 타입 (SHOP, HOME, EVENT) - 선택사항
   * @returns 현재 노출 가능한 배너 목록 (sortOrder 기준 정렬)
   */
  @Get()
  @ApiOperation({
    summary: '활성 배너 목록 조회',
    description: '배너 목록을 조회합니다. 배너 타입을 지정하면 해당 타입의 배너만 반환됩니다. 현재 날짜 기준으로 활성화된 배너만 반환됩니다.'
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['SHOP', 'HOME', 'EVENT'],
    description: '배너 타입 (미지정시 전체 조회)'
  })
  @ApiResponse({
    status: 200,
    description: '배너 목록 조회 성공',
    type: [BannerDto]
  })
  async getActiveBanners(
    @Request() req: any,
    @Query('type') bannerType?: string
  ): Promise<BannerDto[]> {
    return this.bannersService.getActiveBanners(bannerType, req.user.id);
  }
}
