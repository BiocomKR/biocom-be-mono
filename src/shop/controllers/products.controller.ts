import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
  Req
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth
} from '@nestjs/swagger';
import { ProductsService } from '../services/products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProductQueryDto } from '../dto/products/product-query.dto';
import {
  CheckStockRequestDto,
  CheckStockResponseDto,
  GroupedProductResponseDto
} from '../dto/products/product-response.dto';
import { ProductDetailDto } from '../dto/products/product-detail.dto';

@ApiTags('쇼핑몰 - 상품')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shop/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * 상품 목록 조회 (카테고리별 그룹핑)
   */
  @Get()
  @ApiOperation({
    summary: '상품 목록 조회',
    description: '상품 목록을 조회합니다. 필터링 후 카테고리별로 그룹핑하여 간소화된 정보를 반환합니다.'
  })
  @ApiResponse({ status: 200, description: '성공', type: GroupedProductResponseDto })
  async findAll(
    @Query(ValidationPipe) query: ProductQueryDto
  ): Promise<GroupedProductResponseDto> {
    return this.productsService.findAllGrouped(query);
  }

  /**
   * 재고 확인
   */
  @Post('check-stock')
  @ApiOperation({ summary: '재고 확인', description: '상품의 재고를 실시간으로 확인합니다' })
  @ApiBody({ type: CheckStockRequestDto })
  @ApiResponse({ status: 200, description: '성공', type: CheckStockResponseDto })
  async checkStock(
    @Body() dto: CheckStockRequestDto
  ): Promise<CheckStockResponseDto> {
    return this.productsService.checkStock(dto);
  }

  /**
   * 상품 상세 조회 (통합 API: 기본정보 + 옵션 + 리뷰요약 + Q&A요약)
   */
  @Get(':id')
  @ApiOperation({
    summary: '상품 상세 조회',
    description: '상품의 모든 정보를 조회합니다. 기본정보, 옵션, 리뷰 요약, Q&A 요약이 포함됩니다.'
  })
  @ApiParam({ name: 'id', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '성공', type: ProductDetailDto })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없습니다' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ProductDetailDto> {
    return this.productsService.findProductDetail(id);
  }

  /**
   * 상품 조회수 증가
   */
  @Post(':id/view')
  @ApiOperation({ summary: '상품 조회수 증가', description: '로그인한 사용자의 상품 조회수를 증가시킵니다 (중복 조회 제외)' })
  @ApiParam({ name: 'id', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '성공', example: { viewCount: 123, isNewView: true } })
  async increaseViewCount(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any
  ): Promise<{ viewCount: number; isNewView: boolean }> {
    const userId = req.user.id;
    return this.productsService.increaseViewCount(id, userId);
  }
}