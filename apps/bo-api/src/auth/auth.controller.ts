import { Controller, Post, Body, Get, UseGuards, Request, Ip, Headers, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { LoginRateLimit } from '../common/decorators/throttle.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { getNowKST } from '../common/utils/kst-date.util';
import {
  SignInResponseDto,
  RefreshTokenResponseDto,
  LogoutResponseDto,
  UnauthorizedResponseDto,
  ValidationErrorResponseDto,
} from './dto/auth-response.dto';

/**
 * 인증 컨트롤러 (운영자용)
 * 로그인, 로그아웃, 토큰 갱신 등 인증 관련 엔드포인트 제공
 */
@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 운영자 로그인
   */
  @Post('signin')
  @Public()
  @LoginRateLimit()
  @ApiOperation({
    summary: '운영자 로그인',
    description: '이메일과 비밀번호로 로그인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '로그인 성공',
    type: SignInResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '입력값 검증 실패',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '이메일 또는 비밀번호가 올바르지 않습니다.',
    type: UnauthorizedResponseDto,
  })
  async signIn(
    @Body() signInDto: SignInDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<ApiResponseDto> {
    const result = await this.authService.signIn(signInDto, ip, userAgent);

    return {
      success: true,
      message: '로그인되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 토큰 갱신
   */
  @Post('refresh')
  @Public()
  @ApiOperation({
    summary: '액세스 토큰 갱신',
    description: 'Refresh Token을 사용하여 새로운 Access Token을 발급받습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '토큰 갱신 성공',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh Token이 유효하지 않거나 만료됨',
    type: UnauthorizedResponseDto,
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<ApiResponseDto> {
    const result = await this.authService.refreshAccessToken(refreshTokenDto.refreshToken);

    return {
      success: true,
      message: '토큰이 갱신되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 로그아웃
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '로그아웃',
    description: '현재 운영자의 Refresh Token을 삭제합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '로그아웃 성공',
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '인증 실패',
    type: UnauthorizedResponseDto,
  })
  async logout(
    @Request() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<ApiResponseDto> {
    const result = await this.authService.logout(req.user.id, ip, userAgent);

    return {
      success: true,
      message: '로그아웃되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 현재 운영자 정보 조회
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 정보 조회',
    description: '현재 로그인한 운영자 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '조회 성공',
  })
  @ApiResponse({
    status: 401,
    description: '인증 실패',
    type: UnauthorizedResponseDto,
  })
  async getMe(@Request() req: any): Promise<ApiResponseDto> {
    return {
      success: true,
      message: '운영자 정보 조회 성공',
      data: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        accessTier: req.user.accessTier,
        department: req.user.department,
      },
      timestamp: getNowKST(),
    };
  }

  /**
   * [개발용] 유저 ID로 액세스 토큰 발급
   */
  @Post('dev/user-token/:userId')
  @Public()
  @ApiOperation({
    summary: '[개발용] 유저 토큰 발급',
    description: '유저 ID만으로 액세스 토큰을 발급합니다. (비밀번호 검증 없음)',
  })
  @ApiResponse({
    status: 200,
    description: '토큰 발급 성공',
  })
  @ApiResponse({
    status: 401,
    description: '유저를 찾을 수 없습니다.',
    type: UnauthorizedResponseDto,
  })
  async devUserToken(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ApiResponseDto> {
    const result = await this.authService.devLoginByUserId(userId);

    return {
      success: true,
      message: '유저 토큰 발급 성공',
      data: result,
      timestamp: getNowKST(),
    };
  }
}
