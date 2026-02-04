import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MypageService } from './mypage.service';
import {
  CreateAddressDto,
  UpdateAddressDto,
  AddressResponseDto,
} from './dto/address.dto';
import {
  UpdateRefundAccountDto,
  RefundAccountResponseDto,
} from './dto/refund-account.dto';
import {
  SetProfileImageDto,
  ProfileImageResponseDto,
} from './dto/profile-image.dto';
import { WithdrawDto, WithdrawResponseDto } from './dto/withdraw.dto';

/**
 * 마이페이지 컨트롤러
 * - 배송 주소 관리
 * - 환불 계좌 관리
 * - 프로필 이미지 관리
 * - 회원탈퇴
 */
@ApiTags('마이페이지')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class MypageController {
  constructor(private readonly mypageService: MypageService) {}

  // ============================================
  // 배송 주소 API
  // ============================================

  @Get('addresses')
  @ApiOperation({ summary: '배송 주소 목록 조회' })
  @ApiResponse({
    status: 200,
    description: '배송 주소 목록',
    type: [AddressResponseDto],
  })
  async getAddresses(@Req() req: Request): Promise<AddressResponseDto[]> {
    return this.mypageService.getAddresses(req.user.sub);
  }

  @Get('addresses/:id')
  @ApiOperation({ summary: '배송 주소 상세 조회' })
  @ApiParam({ name: 'id', description: '주소 ID' })
  @ApiResponse({
    status: 200,
    description: '배송 주소 상세',
    type: AddressResponseDto,
  })
  @ApiResponse({ status: 404, description: '주소를 찾을 수 없음' })
  async getAddress(
    @Req() req: Request,
    @Param('id', ParseIntPipe) addressId: number,
  ): Promise<AddressResponseDto> {
    return this.mypageService.getAddress(req.user.sub, addressId);
  }

  @Post('addresses')
  @ApiOperation({ summary: '배송 주소 생성' })
  @ApiResponse({
    status: 201,
    description: '생성된 배송 주소',
    type: AddressResponseDto,
  })
  @ApiResponse({ status: 400, description: '최대 주소 개수 초과 또는 유효성 오류' })
  async createAddress(
    @Req() req: Request,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.mypageService.createAddress(req.user.sub, dto);
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: '배송 주소 수정' })
  @ApiParam({ name: 'id', description: '주소 ID' })
  @ApiResponse({
    status: 200,
    description: '수정된 배송 주소',
    type: AddressResponseDto,
  })
  @ApiResponse({ status: 404, description: '주소를 찾을 수 없음' })
  async updateAddress(
    @Req() req: Request,
    @Param('id', ParseIntPipe) addressId: number,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.mypageService.updateAddress(req.user.sub, addressId, dto);
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '배송 주소 삭제' })
  @ApiParam({ name: 'id', description: '주소 ID' })
  @ApiResponse({ status: 204, description: '삭제 완료' })
  @ApiResponse({ status: 404, description: '주소를 찾을 수 없음' })
  async deleteAddress(
    @Req() req: Request,
    @Param('id', ParseIntPipe) addressId: number,
  ): Promise<void> {
    return this.mypageService.deleteAddress(req.user.sub, addressId);
  }

  @Patch('addresses/:id/default')
  @ApiOperation({ summary: '기본 주소 설정' })
  @ApiParam({ name: 'id', description: '주소 ID' })
  @ApiResponse({
    status: 200,
    description: '기본 주소로 설정된 주소',
    type: AddressResponseDto,
  })
  @ApiResponse({ status: 404, description: '주소를 찾을 수 없음' })
  async setDefaultAddress(
    @Req() req: Request,
    @Param('id', ParseIntPipe) addressId: number,
  ): Promise<AddressResponseDto> {
    return this.mypageService.setDefaultAddress(req.user.sub, addressId);
  }

  // ============================================
  // 환불 계좌 API
  // ============================================

  @Get('refund-account')
  @ApiOperation({ summary: '환불 계좌 조회' })
  @ApiResponse({
    status: 200,
    description: '환불 계좌 정보',
    type: RefundAccountResponseDto,
  })
  async getRefundAccount(@Req() req: Request): Promise<RefundAccountResponseDto> {
    return this.mypageService.getRefundAccount(req.user.sub);
  }

  @Patch('refund-account')
  @ApiOperation({ summary: '환불 계좌 수정' })
  @ApiResponse({
    status: 200,
    description: '수정된 환불 계좌 정보',
    type: RefundAccountResponseDto,
  })
  async updateRefundAccount(
    @Req() req: Request,
    @Body() dto: UpdateRefundAccountDto,
  ): Promise<RefundAccountResponseDto> {
    return this.mypageService.updateRefundAccount(req.user.sub, dto);
  }

  @Delete('refund-account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '환불 계좌 삭제' })
  @ApiResponse({ status: 204, description: '삭제 완료' })
  async deleteRefundAccount(@Req() req: Request): Promise<void> {
    return this.mypageService.deleteRefundAccount(req.user.sub);
  }

  // ============================================
  // 프로필 이미지 API
  // ============================================

  @Get('profile-image')
  @ApiOperation({ summary: '프로필 이미지 조회' })
  @ApiResponse({
    status: 200,
    description: '프로필 이미지 정보',
    type: ProfileImageResponseDto,
  })
  async getProfileImage(@Req() req: Request): Promise<ProfileImageResponseDto> {
    return this.mypageService.getProfileImage(req.user.sub);
  }

  @Patch('profile-image')
  @ApiOperation({ summary: '프로필 이미지 설정' })
  @ApiResponse({
    status: 200,
    description: '설정된 프로필 이미지 정보',
    type: ProfileImageResponseDto,
  })
  @ApiResponse({ status: 404, description: '파일을 찾을 수 없음' })
  async setProfileImage(
    @Req() req: Request,
    @Body() dto: SetProfileImageDto,
  ): Promise<ProfileImageResponseDto> {
    return this.mypageService.setProfileImage(req.user.sub, dto.fileId);
  }

  @Delete('profile-image')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '프로필 이미지 삭제' })
  @ApiResponse({ status: 204, description: '삭제 완료' })
  async deleteProfileImage(@Req() req: Request): Promise<void> {
    return this.mypageService.deleteProfileImage(req.user.sub);
  }

  // ============================================
  // 회원탈퇴 API
  // ============================================

  @Post('withdraw')
  @ApiOperation({
    summary: '회원탈퇴',
    description: '회원탈퇴를 처리합니다. 개인정보는 별도 테이블에 보관되며, 기존 정보는 마스킹됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '회원탈퇴 완료',
    type: WithdrawResponseDto,
  })
  @ApiResponse({ status: 400, description: '이미 탈퇴한 회원' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async withdraw(
    @Req() req: Request,
    @Body() dto: WithdrawDto,
  ): Promise<WithdrawResponseDto> {
    return this.mypageService.withdraw(req.user.sub, dto.reason);
  }
}
