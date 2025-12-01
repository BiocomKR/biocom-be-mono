/**
 * 장바구니 관리 컨트롤러 (관리자용)
 * - 전체 장바구니 목록 조회
 * - 사용자별 장바구니 조회
 * - 장바구니 아이템 삭제
 * - 장바구니 통계
 */

import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CartService } from './cart.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(private readonly cartService: CartService) {}

  /**
   * 장바구니 통계 조회
   */
  @Get('statistics')
  async getStatistics(): Promise<ApiResponseDto<any>> {
    this.logger.log('장바구니 통계 조회 요청');

    try {
      const statistics = await this.cartService.getCartStatistics();

      return {
        success: true,
        message: '장바구니 통계가 성공적으로 조회되었습니다.',
        data: statistics,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error('장바구니 통계 조회 실패', error);
      throw error;
    }
  }

  /**
   * 장바구니 목록 조회 (페이징)
   */
  @Get()
  async getCarts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('userName') userName?: string,
    @Query('productId') productId?: string,
    @Query('productName') productName?: string,
    @Query('stockAvailable') stockAvailable?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('장바구니 목록 조회 요청');

    try {
      const result = await this.cartService.getCartsWithPagination(
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : 20,
        {
          userId: userId ? parseInt(userId, 10) : undefined,
          userName: userName || undefined,
          productId: productId ? parseInt(productId, 10) : undefined,
          productName: productName || undefined,
          stockAvailable: stockAvailable !== undefined ? stockAvailable === 'true' : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        {
          sortBy: sortBy || 'addedAt',
          sortOrder: sortOrder || 'desc',
        }
      );

      return {
        success: true,
        message: '장바구니 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error('장바구니 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 사용자별 장바구니 상세 조회
   */
  @Get('user/:userId')
  async getCartByUser(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`사용자 장바구니 조회 요청 - userId: ${userId}`);

    try {
      const cart = await this.cartService.getCartByUserId(userId);

      return {
        success: true,
        message: '사용자 장바구니가 성공적으로 조회되었습니다.',
        data: cart,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`사용자 장바구니 조회 실패 - userId: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 장바구니 아이템 삭제
   */
  @Delete('items/:id')
  async deleteCartItem(
    @Param('id', ParseIntPipe) itemId: number,
  ): Promise<ApiResponseDto<null>> {
    this.logger.log(`장바구니 아이템 삭제 요청 - itemId: ${itemId}`);

    try {
      await this.cartService.deleteCartItem(itemId);

      return {
        success: true,
        message: '장바구니 아이템이 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`장바구니 아이템 삭제 실패 - itemId: ${itemId}`, error);
      throw error;
    }
  }

  /**
   * 사용자 장바구니 전체 비우기
   */
  @Delete('user/:userId/clear')
  async clearUserCart(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ApiResponseDto<null>> {
    this.logger.log(`사용자 장바구니 비우기 요청 - userId: ${userId}`);

    try {
      await this.cartService.clearUserCart(userId);

      return {
        success: true,
        message: '사용자 장바구니가 성공적으로 비워졌습니다.',
        data: null,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`사용자 장바구니 비우기 실패 - userId: ${userId}`, error);
      throw error;
    }
  }
}
