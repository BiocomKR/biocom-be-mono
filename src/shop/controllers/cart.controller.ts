import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Patch,
  Param, 
  Body,
  UseGuards,
  Request,
  ParseIntPipe
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
  ApiBody 
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CartService } from '../services/cart.service';
import {
  AddCartItemDto,
  UpdateCartItemDto,
  CartItemResponseDto,
  CartResponseDto,
  CartValidationResponseDto
} from '../dto/cart/cart-item.dto';

@ApiTags('쇼핑몰 - 장바구니')
@Controller('shop/cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * 장바구니 조회
   */
  @Get()
  @ApiOperation({ summary: '장바구니 조회', description: '현재 사용자의 장바구니를 조회합니다' })
  @ApiResponse({ status: 200, description: '성공', type: CartResponseDto })
  async getCart(@Request() req): Promise<CartResponseDto> {
    return this.cartService.getCart(req.user.id);
  }

  /**
   * 장바구니 아이템 추가
   */
  @Post('items')
  @ApiOperation({ summary: '장바구니 아이템 추가', description: '장바구니에 상품을 추가합니다' })
  @ApiBody({ type: AddCartItemDto })
  @ApiResponse({ status: 201, description: '성공', type: CartItemResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async addItem(
    @Request() req,
    @Body() dto: AddCartItemDto
  ): Promise<CartItemResponseDto> {
    return this.cartService.addItem(req.user.id, dto);
  }

  /**
   * 장바구니 아이템 수량 변경
   */
  @Patch('items/:id')
  @ApiOperation({ summary: '장바구니 아이템 수량 변경', description: '장바구니 아이템의 수량을 변경합니다' })
  @ApiParam({ name: 'id', description: '장바구니 아이템 ID' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({ status: 200, description: '성공', type: CartItemResponseDto })
  @ApiResponse({ status: 404, description: '아이템을 찾을 수 없음' })
  async updateItemQuantity(
    @Request() req,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() dto: UpdateCartItemDto
  ): Promise<CartItemResponseDto> {
    return this.cartService.updateItemQuantity(req.user.id, itemId, dto);
  }

  /**
   * 장바구니 아이템 삭제
   */
  @Delete('items/:id')
  @ApiOperation({ summary: '장바구니 아이템 삭제', description: '장바구니에서 특정 아이템을 삭제합니다' })
  @ApiParam({ name: 'id', description: '장바구니 아이템 ID' })
  @ApiResponse({ status: 200, description: '성공', example: { success: true } })
  @ApiResponse({ status: 404, description: '아이템을 찾을 수 없음' })
  async removeItem(
    @Request() req,
    @Param('id', ParseIntPipe) itemId: number
  ): Promise<{ success: boolean }> {
    return this.cartService.removeItem(req.user.id, itemId);
  }

  /**
   * 장바구니 전체 비우기
   */
  @Delete('clear')
  @ApiOperation({ summary: '장바구니 전체 비우기', description: '장바구니의 모든 아이템을 삭제합니다' })
  @ApiResponse({ status: 200, description: '성공', example: { success: true } })
  async clearCart(@Request() req): Promise<{ success: boolean }> {
    return this.cartService.clearCart(req.user.id);
  }

  /**
   * 장바구니 재고 검증
   */
  @Post('validate')
  @ApiOperation({ summary: '장바구니 재고 검증', description: '장바구니 아이템들의 재고를 일괄 확인합니다' })
  @ApiResponse({ status: 200, description: '성공', type: CartValidationResponseDto })
  async validateCart(@Request() req): Promise<CartValidationResponseDto> {
    return this.cartService.validateCart(req.user.id);
  }

  /**
   * 장바구니 아이템 수 조회
   */
  @Get('count')
  @ApiOperation({ summary: '장바구니 아이템 수 조회', description: '장바구니에 담긴 아이템 수를 조회합니다' })
  @ApiResponse({ status: 200, description: '성공', example: { count: 5 } })
  async getCartItemCount(@Request() req): Promise<{ count: number }> {
    const count = await this.cartService.getCartItemCount(req.user.id);
    return { count };
  }
}