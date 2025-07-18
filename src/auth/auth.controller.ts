import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { LoginRateLimit, SignupRateLimit } from '../common/decorators/throttle.decorator';

/**
 * 인증 컨트롤러
 * 회원가입, 로그인, 프로필 조회 등 인증 관련 엔드포인트 제공
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  /**
   * 내 프로필 조회
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle() // 인증된 사용자는 Rate Limiting 제외
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '내 프로필 조회', 
    description: '현재 로그인한 사용자의 프로필을 조회합니다.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '프로필 조회 성공',
    schema: {
      example: {
        success: true,
        message: '프로필을 조회했습니다.',
        data: {
          id: 1,
          email: 'user@example.com',
          nickname: 'nickname',
          createdAt: '2024-01-01T00:00:00.000Z'
        },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: '인증되지 않은 요청' 
  })
  async getProfile(@Request() req): Promise<ApiResponseDto> {
    return {
      success: true,
      message: '프로필을 조회했습니다.',
      data: req.user,
      timestamp: new Date(),
    };
  }
}