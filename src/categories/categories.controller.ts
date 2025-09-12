import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CategoryResponseDto, CategoryWithCountDto } from './dto/category-response.dto';

// 쇼핑몰 관련 API 임시 비활성화
@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * 카테고리 목록 조회
   */
  @Get()
  @ApiOperation({ summary: '카테고리 목록 조회', description: '활성화된 카테고리 목록을 조회합니다' })
  @ApiQuery({ name: 'parent_id', required: false, description: '상위 카테고리 ID' })
  @ApiResponse({ status: 200, description: '성공', type: [CategoryResponseDto] })
  async findAll(@Query('parent_id') parentId?: string): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll(parentId ? parseInt(parentId) : undefined);
  }

  /**
   * 카테고리 트리 조회
   */
  @Get('tree')
  @ApiOperation({ summary: '카테고리 트리 조회', description: '전체 카테고리를 트리 구조로 조회합니다' })
  @ApiResponse({ status: 200, description: '성공', type: [CategoryResponseDto] })
  async getCategoryTree(): Promise<CategoryResponseDto[]> {
    return this.categoriesService.getCategoryTree();
  }

  /**
   * 카테고리별 상품 수 조회
   */
  @Get('with-count')
  @ApiOperation({ summary: '카테고리별 상품 수 조회', description: '각 카테고리의 상품 수를 포함하여 조회합니다' })
  @ApiResponse({ status: 200, description: '성공', type: [CategoryWithCountDto] })
  async findAllWithProductCount(): Promise<CategoryWithCountDto[]> {
    return this.categoriesService.findAllWithProductCount();
  }

  /**
   * 카테고리 상세 조회
   */
  @Get(':id')
  @ApiOperation({ summary: '카테고리 상세 조회', description: '특정 카테고리의 상세 정보를 조회합니다' })
  @ApiParam({ name: 'id', description: '카테고리 ID' })
  @ApiResponse({ status: 200, description: '성공', type: CategoryResponseDto })
  @ApiResponse({ status: 404, description: '카테고리를 찾을 수 없습니다' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CategoryResponseDto> {
    return this.categoriesService.findOne(id);
  }

  /**
   * 카테고리 경로 조회
   */
  @Get(':id/path')
  @ApiOperation({ summary: '카테고리 경로 조회', description: 'Breadcrumb용 카테고리 경로를 조회합니다' })
  @ApiParam({ name: 'id', description: '카테고리 ID' })
  @ApiResponse({ status: 200, description: '성공', type: [CategoryResponseDto] })
  @ApiResponse({ status: 404, description: '카테고리를 찾을 수 없습니다' })
  async getCategoryPath(@Param('id', ParseIntPipe) id: number): Promise<CategoryResponseDto[]> {
    return this.categoriesService.getCategoryPath(id);
  }
}
