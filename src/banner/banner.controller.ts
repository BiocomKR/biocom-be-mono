import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BannerService } from './banner.service';
import { UploadService } from '../upload/upload.service';

@ApiTags('배너 관리')
@ApiBearerAuth()
@Controller('banners')
@UseGuards(JwtAuthGuard)
export class BannerController {
  constructor(
    private readonly bannerService: BannerService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * 배너 목록 조회
   */
  @Get()
  async getBanners(
    @Query('bannerType') bannerType?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bannerService.getBanners({
      bannerType,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  /**
   * 배너 상세 조회
   */
  @Get(':id')
  async getBannerById(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.getBannerById(id);
  }

  /**
   * 배너 생성
   */
  @Post()
  async createBanner(@Body() dto: any) {
    return this.bannerService.createBanner({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
  }

  /**
   * 배너 수정
   */
  @Put(':id')
  async updateBanner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
  ) {
    return this.bannerService.updateBanner(id, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
  }

  /**
   * 배너 삭제
   */
  @Delete(':id')
  async deleteBanner(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.deleteBanner(id);
  }

  /**
   * 배너 활성화/비활성화 토글
   */
  @Patch(':id/toggle')
  async toggleBannerActive(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.toggleBannerActive(id);
  }

  /**
   * 배너 정렬 순서 일괄 변경
   */
  @Patch('orders')
  async updateBannerOrders(@Body() dto: { orders: { id: number; sortOrder: number }[] }) {
    return this.bannerService.updateBannerOrders(dto.orders);
  }

  /**
   * 배너 이미지 업로드
   */
  @Post('upload-image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBannerImage(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadService.uploadProductImage(file);
    return {
      imageUrl: result.filePath,
      fileId: result.id,
    };
  }
}
