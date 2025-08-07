import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { LoginRateLimit, SignupRateLimit } from '../common/decorators/throttle.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ImwebAuthService } from '@/imweb/imweb-auth.service';

/**
 * 인증 컨트롤러
 * 회원가입, 로그인, 프로필 조회 등 인증 관련 엔드포인트 제공
 */
@ApiTags('auth')
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
    schema: {
      example: {
        success: true,
        message: '회원가입이 완료되었습니다.',
        data: {
          user: {
            id: 1,
            email: 'user@example.com',
            nickname: 'nickname',
            createdAt: '2024-01-01T00:00:00.000Z'
          },
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 409, 
    description: '이미 존재하는 이메일' 
  })
  async signUp(@Body() signUpDto: SignUpDto): Promise<ApiResponseDto> {
    const result = await this.authService.signUp(signUpDto);
    
    return {
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: result,
      timestamp: new Date(),
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
    schema: {
      example: {
        success: true,
        message: '로그인되었습니다.',
        data: {
          user: {
            id: 1,
            email: 'user@example.com',
            nickname: 'nickname',
            createdAt: '2024-01-01T00:00:00.000Z'
          },
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: '이메일 또는 비밀번호가 올바르지 않습니다.' 
  })
  async signIn(@Body() signInDto: SignInDto): Promise<ApiResponseDto> {
    const result = await this.authService.signIn(signInDto);
    
    return {
      success: true,
      message: '로그인되었습니다.',
      data: result,
      timestamp: new Date(),
    };
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
  
}