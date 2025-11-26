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
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.shopService.getProducts({
      status,
      categoryId: category ? parseInt(category) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20
    });
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

  @Post('products/:id/images')
        async addProductImage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any
  ) {
    return this.shopService.addProductImage(id, dto);
  }

  /**
   * 주문 관리
   */
  @Get('orders')
              async getOrders(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.shopService.getOrders({
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20
    });
  }

  @Get('orders/:orderNumber')
      async getOrderDetail(@Param('orderNumber') orderNumber: string) {
    return this.shopService.getOrderDetail(orderNumber);
  }

  @Patch('orders/:orderNumber/status')
        async updateOrderStatus(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: { status: string; reason: string }
  ) {
    return this.shopService.updateOrderStatus(orderNumber, dto.status, dto.reason);
  }

  @Post('orders/:orderNumber/memo')
        async addOrderMemo(
    @Param('orderNumber') orderNumber: string,
    @Body('memo') memo: string
  ) {
    return this.shopService.addOrderMemo(orderNumber, memo);
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

  /**
   * 배송비 정책 관리
   */
  @Get('shipping-policies')
    async getShippingPolicies() {
    return this.shopService.getShippingPolicies();
  }

  @Post('shipping-policies')
      async createShippingPolicy(@Body() dto: any) {
    return this.shopService.createShippingPolicy(dto);
  }

  @Put('shipping-policies/:id')
      async updateShippingPolicy(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any
  ) {
    return this.shopService.updateShippingPolicy(id, dto);
  }

  /**
   * ⚠️ 재고 관리 API 제거됨
   * - 외부 재고 시스템 연동 기능은 나중에 기획안 확정 후 재구현 예정
   */
  // @Get('inventory')
  // async getInventory(
  //   @Query('sku') sku?: string,
  //   @Query('lowStock') lowStock?: string
  // ) {
  //   return this.shopService.getInventory({
  //     sku,
  //     lowStock: lowStock === 'true'
  //   });
  // }

  // @Post('inventory/sync')
  // async syncInventory() {
  //   return this.shopService.syncInventory();
  // }

  // @Patch('inventory/:sku')
  // async adjustInventory(
  //   @Param('sku') sku: string,
  //   @Body() dto: { quantity: number; reason: string }
  // ) {
  //   return this.shopService.adjustInventory(sku, dto.quantity, dto.reason);
  // }
}