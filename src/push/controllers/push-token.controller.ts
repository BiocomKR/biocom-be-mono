import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PushTokenService } from '../services/push-token.service';
import { RegisterPushTokenDto } from '../dto/register-push-token.dto';
import { PushTokenResponseDto } from '../dto/push-token-response.dto';
import { rateLimitConfig } from '../../common/config/throttler.config';

/**
 * 푸시 토큰 관리 컨트롤러
 *
 * 인증된 유저의 FCM 토큰 등록/조회/삭제 API
 */
@ApiTags('푸시-토큰관리')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push/tokens')
export class PushTokenController {
  constructor(private readonly pushTokenService: PushTokenService) {}

  /**
   * 푸시 토큰 등록/업데이트
   *
   * 유저의 디바이스 FCM 토큰을 등록하거나 업데이트
   *
   * @param req - JWT 인증된 요청 (req.user.id)
   * @param dto - 토큰 등록 정보
   * @returns 등록된 토큰 정보
   */
  @Post()
  @Throttle({ short: { ttl: rateLimitConfig.pushTokenRegister.ttl * 1000, limit: rateLimitConfig.pushTokenRegister.limit } })
  @ApiOperation({
    summary: '푸시 토큰 등록/업데이트',
    description: '유저의 디바이스 FCM 토큰을 등록하거나 업데이트합니다',
  })
  @ApiResponse({
    status: 201,
    description: '토큰 등록 성공',
    type: PushTokenResponseDto,
  })
  async registerToken(
    @Req() req: any,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<PushTokenResponseDto> {
    const userId = req.user.id;
    return await this.pushTokenService.registerToken(userId, dto);
  }

  /**
   * 내 푸시 토큰 목록 조회
   *
   * 현재 로그인한 유저의 모든 활성 토큰 조회
   *
   * @param req - JWT 인증된 요청
   * @returns 토큰 목록
   */
  @Get()
  @ApiOperation({
    summary: '내 푸시 토큰 목록 조회',
    description: '현재 로그인한 유저의 모든 활성 토큰을 조회합니다',
  })
  @ApiResponse({
    status: 200,
    description: '토큰 목록 조회 성공',
    type: [PushTokenResponseDto],
  })
  async getMyTokens(@Req() req: any): Promise<PushTokenResponseDto[]> {
    const userId = req.user.id;
    return await this.pushTokenService.getUserTokens(userId);
  }

  /**
   * 특정 디바이스 토큰 삭제 (비활성화)
   *
   * @param req - JWT 인증된 요청
   * @param deviceId - 디바이스 ID
   */
  @Delete(':deviceId')
  @ApiOperation({
    summary: '특정 디바이스 토큰 삭제',
    description: '특정 디바이스의 푸시 토큰을 비활성화합니다',
  })
  @ApiResponse({
    status: 200,
    description: '토큰 삭제 성공',
  })
  async deleteToken(
    @Req() req: any,
    @Param('deviceId') deviceId: string,
  ): Promise<{ message: string }> {
    const userId = req.user.id;
    await this.pushTokenService.deleteToken(userId, deviceId);
    return { message: '토큰이 삭제되었습니다' };
  }

  /**
   * 내 모든 토큰 삭제 (비활성화)
   *
   * @param req - JWT 인증된 요청
   */
  @Delete()
  @ApiOperation({
    summary: '내 모든 토큰 삭제',
    description: '현재 로그인한 유저의 모든 푸시 토큰을 비활성화합니다',
  })
  @ApiResponse({
    status: 200,
    description: '모든 토큰 삭제 성공',
  })
  async deleteAllTokens(@Req() req: any): Promise<{ message: string }> {
    const userId = req.user.id;
    await this.pushTokenService.deleteAllUserTokens(userId);
    return { message: '모든 토큰이 삭제되었습니다' };
  }
}
