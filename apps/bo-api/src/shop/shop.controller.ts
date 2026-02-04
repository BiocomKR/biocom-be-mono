import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShopService } from './shop.service';

@ApiTags('상품 관리')
@ApiBearerAuth()
@Controller('shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  /**
   * 상품 관리
   */
  @Get('products')
  async getProducts(
    @Query('status') status?: string,
    @Query('categoryCode') categoryCode?: string,
    @Query('search') search?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.shopService.getProducts({
      status,
      categoryCode,
      search,
      isFeatured: isFeatured === 'true' ? true : isFeatured === 'false' ? false : undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20
    });
  }

  @Get('products/check-sku')
  async checkSkuDuplicate(@Query('sku') sku: string, @Query('excludeId') excludeId?: string) {
    return this.shopService.checkSkuDuplicate(sku, excludeId ? parseInt(excludeId) : undefined);
  }

  @Get('products/:id')
  async getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.shopService.getProductById(id);
  }

  @Post('products')
  async createProduct(@Body() dto: any) {
    return this.shopService.createProduct(dto);
  }

  @Put('products/:id')
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any
  ) {
    return this.shopService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  async deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.shopService.deleteProduct(id);
  }

  /**
   * 상품 이미지 업로드 (MAIN/CONTENT 타입)
   * @param reorder - 기존 이미지 순서 변경 정보 (JSON 배열: [{id: ProductFile.id, sortOrder: number}])
   * @param newFileSortOrders - 새 파일 순서 정보 (JSON 배열: [sortOrder1, sortOrder2, ...], files 순서와 1:1 매칭)
   */
  @Post('products/:id/images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadProductImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('deleteFileIds') deleteFileIds?: string,
    @Body('imageType') imageType?: string,
    @Body('reorder') reorder?: string,
    @Body('newFileSortOrders') newFileSortOrders?: string,
  ) {
    return this.shopService.uploadProductImages(id, files, deleteFileIds, imageType, reorder, newFileSortOrders);
  }

  /**
   * ⚠️ 카테고리 관리 API 제거됨
   * - Categories 테이블 제거 (소규모 쇼핑몰)
   * - Products.categoryCode, categoryName으로 관리
   */
  // @Post('categories')
  // async createCategory(@Body() dto: any) {
  //   return this.shopService.createCategory(dto);
  // }

  // @Put('categories/:id')
  // async updateCategory(
  //   @Param('id', ParseIntPipe) id: number,
  //   @Body() dto: any
  // ) {
  //   return this.shopService.updateCategory(id, dto);
  // }

  // @Delete('categories/:id')
  // async deleteCategory(@Param('id', ParseIntPipe) id: number) {
  //   return this.shopService.deleteCategory(id);
  // }
}