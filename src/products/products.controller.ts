import { 
  Controller, 
  Get, 
  Post, 
  Param, 
  Query, 
  Body,
  ParseIntPipe,
  ValidationPipe
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam,
  ApiBody 
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { 
  ProductResponseDto, 
  ProductPaginatedResponseDto,
  CheckStockRequestDto,
  CheckStockResponseDto 
} from './dto/product-response.dto';

// 쇼핑몰 관련 API 임시 비활성화
@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * 상품 목록 조회
   */
  @Get()
  @ApiOperation({ summary: '상품 목록 조회', description: '상품 목록을 페이지네이션하여 조회합니다' })
  @ApiResponse({ status: 200, description: '성공', type: ProductPaginatedResponseDto })
  async findAll(
    @Query(ValidationPipe) query: ProductQueryDto
  ): Promise<ProductPaginatedResponseDto> {
    return this.productsService.findAll(query);
  }

  /**
   * 상품 검색
   */
  @Get('search')
  @ApiOperation({ summary: '상품 검색', description: '키워드로 상품을 검색합니다' })
  @ApiResponse({ status: 200, description: '성공', type: ProductPaginatedResponseDto })
  async search(
    @Query('q') keyword: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<ProductPaginatedResponseDto> {
    return this.productsService.search(
      keyword,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  /**
   * 추천 상품 조회
   */
  @Get('featured')
  @ApiOperation({ summary: '추천 상품 조회', description: '추천 상품 목록을 조회합니다' })
  @ApiResponse({ status: 200, description: '성공', type: [ProductResponseDto] })
  async findFeatured(
    @Query('limit') limit?: string
  ): Promise<ProductResponseDto[]> {
    return this.productsService.findFeatured(limit ? parseInt(limit) : 10);
  }

  /**
   * 인기 상품 조회
   */
  @Get('popular')
  @ApiOperation({ summary: '인기 상품 조회', description: '최근 30일간 인기 상품을 조회합니다' })
  @ApiResponse({ status: 200, description: '성공', type: [ProductResponseDto] })
  async findPopular(
    @Query('limit') limit?: string
  ): Promise<ProductResponseDto[]> {
    return this.productsService.findPopular(limit ? parseInt(limit) : 10);
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
   * 상품 상세 조회
   */
  @Get(':id')
  @ApiOperation({ summary: '상품 상세 조회', description: '특정 상품의 상세 정보를 조회합니다' })
  @ApiParam({ name: 'id', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '성공', type: ProductResponseDto })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없습니다' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }

  /**
   * 상품 조회수 증가
   */
  @Post(':id/view')
  @ApiOperation({ summary: '상품 조회수 증가', description: '상품 조회수를 1 증가시킵니다' })
  @ApiParam({ name: 'id', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '성공', example: { viewCount: 123 } })
  async increaseViewCount(
    @Param('id', ParseIntPipe) id: number
  ): Promise<{ viewCount: number }> {
    return this.productsService.increaseViewCount(id);
  }
}