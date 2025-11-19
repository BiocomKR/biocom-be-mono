import {
  Controller,
  Get,
  Patch,
  Body,
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
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import {
  SearchImwebMembersResponseDto,
  GetMyProfileResponseDto,
  UpdateUserResponseDto,
  GetMyPointsResponseDto,
} from './dto/user-response.dto';
import { ApiErrorResponseDto } from '../common/dto/api-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 사용자 컨트롤러
 * 일반 사용자용 API
 */
@ApiTags('헬스케어-사용자')
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
    type: SearchImwebMembersResponseDto,
  })
  @ApiResponse({ 
    status: 404, 
    description: '해당 전화번호로 등록된 회원을 찾을 수 없음',
    type: ApiErrorResponseDto,
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
        timestamp: getNowKST(),
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
  @ApiBearerAuth()
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
      timestamp: getNowKST(),
    };
  }

  /**
   * 현재 로그인한 사용자 정보 수정
   * AI 페르소나 선택 등 사용자 프로필 업데이트
   * @deprecated 보안상 이유로 deprecated 처리. 신규 전용 API 사용 권장
   */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Deprecated] 내 정보 수정',
    description: '[Deprecated] 현재 로그인한 사용자의 정보를 수정합니다. AI 페르소나 선택, 이름/휴대폰 변경 등이 가능합니다.',
    deprecated: true
  })
  @ApiResponse({
    status: 200,
    description: '사용자 정보 수정 성공',
    schema: {
      example: {
        success: true,
        message: '사용자 정보가 수정되었습니다.',
        data: {
          id: 1,
          email: 'user1@example.com',
          name: '김철수',
          mobile: '01012345678',
          points: 100,
          aiPersonaId: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z'
        },
        timestamp: '2024-01-02T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: '페르소나를 찾을 수 없음',
    type: ApiErrorResponseDto
  })
  @ApiResponse({
    status: 409,
    description: '비활성화된 페르소나이거나 이메일 중복',
    type: ApiErrorResponseDto
  })
  async updateMe(
    @Request() req: any,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<ApiResponseDto> {
    // JWT payload에서 sub (user id) 추출
    const userId = req.user.sub;
    const user = await this.usersService.update(userId, updateUserDto);

    return {
      success: true,
      message: '사용자 정보가 수정되었습니다.',
      data: user,
      timestamp: getNowKST(),
    };
  }

  /**
   * 현재 로그인한 사용자의 AI 페르소나 업데이트
   * 페르소나 식별자만 안전하게 변경
   */
  @Patch('me/persona')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AI 페르소나 업데이트',
    description: '현재 로그인한 사용자의 AI 페르소나 식별자를 업데이트합니다. 페르소나 ID만 변경 가능합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '페르소나 업데이트 성공',
    schema: {
      example: {
        success: true,
        message: 'AI 페르소나가 업데이트되었습니다.',
        data: {
          id: 1,
          email: 'user1@example.com',
          name: '김철수',
          mobile: '01012345678',
          points: 100,
          aiPersonaId: 2,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z'
        },
        timestamp: '2024-01-02T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: '페르소나를 찾을 수 없음',
    type: ApiErrorResponseDto
  })
  @ApiResponse({
    status: 409,
    description: '비활성화된 페르소나',
    type: ApiErrorResponseDto
  })
  async updatePersona(
    @Request() req: any,
    @Body() updatePersonaDto: UpdatePersonaDto
  ): Promise<ApiResponseDto> {
    // JWT payload에서 sub (user id) 추출
    const userId = req.user.sub;
    const user = await this.usersService.updatePersona(userId, updatePersonaDto.aiPersonaId);

    return {
      success: true,
      message: 'AI 페르소나가 업데이트되었습니다.',
      data: user,
      timestamp: getNowKST(),
    };
  }
}