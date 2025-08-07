import { 
  Controller, 
  Get, 
  Param, 
  UseGuards,
  Request
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { UsersService } from './users.service';
import { ImwebApiService } from '../imweb/imweb-api.service';

/**
 * 사용자 컨트롤러
 * 일반 사용자용 API
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly imwebApiService: ImwebApiService,
  ) {}

  /**
   * 아임웹 회원 검색 (전화번호)
   * 전화번호로 아임웹 회원을 검색하고 상세 정보를 조회
   */
  @Get('imweb/search-by-phone/:phone')
  @ApiOperation({ 
    summary: '아임웹 회원 검색 (전화번호)', 
    description: '전화번호로 아임웹 회원을 검색하고 모든 회원의 상세 정보를 조회합니다.' 
  })
  @ApiParam({ 
    name: 'phone', 
    required: true, 
    type: String, 
    description: '검색할 전화번호 (예: 01056060746)' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '회원 검색 성공',
    schema: {
      example: {
        success: true,
        message: '아임웹 회원 검색이 완료되었습니다.',
        data: [
          {
            memberUid: 'example@email.com',
            name: '홍길동',
            phone: '01056060746',
            // ... 기타 회원 정보
          }
        ],
        meta: {
          version: 'v2',
          timestamp: '2024-01-01T00:00:00.000Z',
          count: 1
        },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: '해당 전화번호로 등록된 회원을 찾을 수 없음' 
  })
  async searchImwebMembersByPhone(
    @Param('phone') phone: string
  ): Promise<ApiResponseDto> {
    console.log('searchImwebMembersByPhone 호출됨, phone:', phone);
    try {
      const members = await this.imwebApiService.searchMembersByPhone(phone);
      
      return {
        success: true,
        message: '아임웹 회원 검색이 완료되었습니다.',
        data: members,
        meta: {
          version: 'v2',
          timestamp: new Date(),
          count: members.length,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('아임웹 회원 검색 에러:', error);
      throw error;
    }
  }

  /**
   * 현재 로그인한 사용자 정보 조회
   * JWT 토큰에서 사용자 ID를 추출하여 조회
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ 
    summary: '내 정보 조회', 
    description: 'JWT 토큰을 통해 현재 로그인한 사용자의 정보를 조회합니다.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 조회 성공',
    schema: {
      example: {
        success: true,
        message: '사용자 정보를 조회했습니다.',
        data: {
          id: 1,
          email: 'user1@example.com',
          nickname: 'user1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        meta: {
          version: 'v2',
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: '사용자를 찾을 수 없음' 
  })
  async findMe(
    @Request() req: any
  ): Promise<ApiResponseDto> {
    // JWT payload에서 sub (user id) 추출
    const userId = req.user.sub;
    const user = await this.usersService.findOne(userId);
    
    return {
      success: true,
      message: '사용자 정보를 조회했습니다.',
      data: user,
      meta: {
        version: 'v2',
        timestamp: new Date(),
      },
      timestamp: new Date(),
    };
  }
}