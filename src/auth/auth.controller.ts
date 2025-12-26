import { Controller, Post, Body, Get, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { PhoneLoginDto } from './dto/phone-login.dto';
import { PhoneRegisterDto } from './dto/phone-register.dto';
import { PhoneRequestDto } from './dto/phone-request.dto';
import { CheckMobileDto } from './dto/check-mobile.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { LoginRateLimit, SignupRateLimit } from '../common/decorators/throttle.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ImwebAuthService } from '@/imweb/imweb-auth.service';
import { getNowKST } from '../common/utils/kst-date.util';
import {
  SignUpResponseDto,
  SignInResponseDto,
  RefreshTokenResponseDto,
  LogoutResponseDto,
  UnauthorizedResponseDto,
  ValidationErrorResponseDto,
  ConflictErrorResponseDto,
} from './dto/auth-response.dto';

/**
 * 인증 컨트롤러
 * 회원가입, 로그인, 프로필 조회 등 인증 관련 엔드포인트 제공
 */
@ApiTags('시스템-인증')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly imwebAuthService: ImwebAuthService,
  ) {
    console.log('[AuthController] 생성자 호출');
    console.log('[AuthController] imwebAuthService 주입됨:', !!this.imwebAuthService);
  }

  /**
   * 회원가입
   */
  @Post('signup')
  @SignupRateLimit() // 1시간에 3번 제한
  @ApiOperation({ 
    summary: '회원가입', 
    description: '새로운 사용자를 등록합니다.' 
  })
  @ApiResponse({ 
    status: 201, 
    description: '회원가입 성공',
    type: SignUpResponseDto,
  })
  @ApiResponse({ 
    status: 400,
    description: '입력값 검증 실패',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({ 
    status: 409, 
    description: '이미 존재하는 이메일',
    type: ConflictErrorResponseDto,
  })
  async signUp(@Body() signUpDto: SignUpDto): Promise<ApiResponseDto> {
    const result = await this.authService.signUp(signUpDto);
    
    return {
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 로그인
   */
  @Post('signin')
  @LoginRateLimit() // 5분에 5번 제한
  @ApiOperation({ 
    summary: '로그인', 
    description: '이메일과 비밀번호로 로그인합니다.' 
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
  async signIn(@Body() signInDto: SignInDto): Promise<ApiResponseDto> {
    const result = await this.authService.signIn(signInDto);
    
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
  @Public() // Refresh Token으로 인증하므로 JWT Guard 제외
  @ApiOperation({ 
    summary: '액세스 토큰 갱신', 
    description: 'Refresh Token을 사용하여 새로운 Access Token을 발급받습니다.' 
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
    description: '현재 사용자의 Refresh Token을 삭제합니다.' 
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
  async logout(@Request() req): Promise<ApiResponseDto> {
    const result = await this.authService.logout(req.user.id);
    
    return {
      success: true,
      message: '로그아웃되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }


  /**
   * ImWeb OAuth 콜백 처리
   * ImWeb에서 인증 완료 후 redirect되는 엔드포인트
   * Swagger 문서에서 숨김 처리 (내부 처리용)
   */
  @Get('redirect')
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint() // Swagger에서 제외
  async handleOAuthRedirect(
    @Query('code') code?: string,
    @Query('errorCode') errorCode?: string,
    @Query('error') error?: string
  ): Promise<ApiResponseDto> {
    console.log('[OAuth Redirect] 콜백 처리 시작');
    console.log('[OAuth Redirect] 받은 파라미터:', { code, errorCode, error });

    try {
      // 에러가 있는 경우 처리
      if (errorCode || error) {
        console.error('[OAuth Redirect] OAuth 에러:', { errorCode, error });
        return {
          success: false,
          message: 'OAuth 인증 실패',
          data: { errorCode, error },
          timestamp: getNowKST(),
        };
      }

      // authorization code가 없는 경우
      if (!code) {
        console.error('[OAuth Redirect] authorization code 누락');
        return {
          success: false,
          message: 'authorization code가 필요합니다.',
          data: null,
          timestamp: getNowKST(),
        };
      }

      // ImWeb OAuth 토큰 교환 처리
      console.log('[OAuth Redirect] ImWeb 토큰 교환 시작, code:', code);
      const accessToken = await this.imwebAuthService.exchangeCodeForToken(code);
      
      console.log('[OAuth Redirect] 토큰 교환 성공, accessToken 획득');
      
      return {
        success: true,
        message: 'OAuth 인증이 완료되었습니다.',
        data: {
          accessToken,
          code
        },
        timestamp: getNowKST(),
      };

    } catch (error) {
      console.error('[OAuth Redirect] 처리 중 에러 발생:', error);
      
      return {
        success: false,
        message: 'OAuth 콜백 처리 중 오류가 발생했습니다.',
        data: { error: error.message },
        timestamp: getNowKST(),
      };
    }
  }

  @Get('test-token')
  @Public()
  @SkipThrottle()
  @ApiOperation({
    summary: '토큰 발행 테스트',
    description: '액세스 토큰 발행 및 저장 테스트'
  })
  async testToken() {
    console.log('[test-token] 메서드 진입');
    try {
      // 현재 저장된 토큰 확인
      const currentToken = await this.imwebAuthService.getValidAccessToken('S20190715619285c855898');
      console.log('[test-token] 새로운 액세스 토큰:', currentToken);

      return {
        message: '토큰 발행 및 저장 테스트',
        accessToken: currentToken
      };
    } catch (error) {
      console.error('[test-token] 에러 발생:', error);
      // 에러 상세 정보 로깅
      if (error.error && error.error.details) {
        console.error('[test-token] 에러 상세:', JSON.stringify(error.error.details, null, 2));
      }
      throw error;
    }
  }

  /**
   * 휴대폰 번호 중복 체크
   */
  @Post('check-mobile')
  @ApiOperation({
    summary: '휴대폰 번호 중복 체크',
    description: '회원가입 전 해당 휴대폰 번호로 가입된 사용자가 있는지 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '중복 체크 완료',
    schema: {
      example: {
        success: true,
        message: '가입 가능한 휴대폰 번호입니다.',
        data: {
          exists: false,
        },
        timestamp: '2025-12-26T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '입력값 검증 실패',
    type: ValidationErrorResponseDto,
  })
  async checkMobile(@Body() checkMobileDto: CheckMobileDto): Promise<ApiResponseDto> {
    const result = await this.authService.checkMobile(checkMobileDto.mobile);

    return {
      success: true,
      message: result.message,
      data: { exists: result.exists },
      timestamp: getNowKST(),
    };
  }

  /**
   * 휴대폰 간편 인증 요청 (간편 로그인용)
   */
  @Post('phone-request')
  @LoginRateLimit() // 5분에 5번 제한
  @ApiOperation({
    summary: '휴대폰 간편 인증 요청',
    description: '통신사 + 휴대폰번호로 사용자 조회 후 본인인증을 시작합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '본인인증 요청 성공',
    schema: {
      example: {
        success: true,
        message: 'SMS가 발송되었습니다. 인증번호를 확인해주세요.',
        data: {
          certNumber: 'PER2025111201234567',
        },
        timestamp: '2025-11-12T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '입력값 검증 실패',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '등록되지 않은 휴대폰 번호',
    schema: {
      example: {
        success: false,
        statusCode: 404,
        message: '등록되지 않은 휴대폰 번호입니다. 회원가입을 먼저 진행해주세요.',
      },
    },
  })
  async phoneRequest(@Body() phoneRequestDto: PhoneRequestDto): Promise<ApiResponseDto> {
    const result = await this.authService.phoneRequest(phoneRequestDto);

    return {
      success: true,
      message: result.message,
      data: { certNumber: result.certNumber },
      timestamp: getNowKST(),
    };
  }

  /**
   * 휴대폰 로그인
   */
  @Post('phone-login')
  @LoginRateLimit() // 5분에 5번 제한
  @ApiOperation({
    summary: '휴대폰 로그인',
    description: '휴대폰 본인인증 완료 후 휴대폰 번호로 로그인합니다.',
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
    description: '등록되지 않은 휴대폰 번호 또는 차단된 계정',
    type: UnauthorizedResponseDto,
  })
  async phoneLogin(@Body() phoneLoginDto: PhoneLoginDto): Promise<ApiResponseDto> {
    const result = await this.authService.phoneLogin(phoneLoginDto);

    return {
      success: true,
      message: '로그인되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 휴대폰 회원가입
   */
  @Post('phone-register')
  @SignupRateLimit() // 1시간에 3번 제한
  @ApiOperation({
    summary: '휴대폰 회원가입',
    description: '휴대폰 본인인증 완료 후 회원가입합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '회원가입 성공',
    type: SignUpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '입력값 검증 실패',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: '이미 존재하는 휴대폰 번호',
    type: ConflictErrorResponseDto,
  })
  async phoneRegister(@Body() phoneRegisterDto: PhoneRegisterDto): Promise<ApiResponseDto> {
    const result = await this.authService.phoneRegister(phoneRegisterDto);

    return {
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

}