import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
  ParseIntPipe,
  UseGuards,
  Request
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * 사용자 관리 컨트롤러
 * 사용자 CRUD 기능을 제공하는 RESTful API
 */
@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * 사용자 목록 조회 (V2 방식)
   * offset/limit 기반 페이지네이션, 필터링, 정렬 지원
   */
  @Get()
  @ApiOperation({ 
    summary: '사용자 목록 조회', 
    description: 'V2 방식 - offset/limit 기반 페이지네이션, 필터링 및 정렬을 지원합니다.' 
  })
  @ApiQuery({ 
    name: 'offset', 
    required: false, 
    type: Number, 
    description: '시작 위치 (기본값: 0)' 
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: '조회 개수 (기본값: 10, 최대: 100)' 
  })
  @ApiQuery({ 
    name: 'search', 
    required: false, 
    type: String, 
    description: '이메일 또는 닉네임으로 검색' 
  })
  @ApiQuery({ 
    name: 'sort', 
    required: false, 
    type: String, 
    description: '정렬 기준 (예: createdAt:desc, email:asc)' 
  })
  @ApiQuery({ 
    name: 'include', 
    required: false, 
    type: [String], 
    description: '포함할 관련 리소스 (예: fileUploads)' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 목록 조회 성공',
    schema: {
      example: {
        success: true,
        message: '사용자 목록을 조회했습니다.',
        data: {
          items: [
            {
              id: 1,
              email: 'user1@example.com',
              nickname: 'user1',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            }
          ],
          pagination: {
            offset: 0,
            limit: 10,
            total: 1,
            hasNext: false,
            hasPrev: false
          },
          filters: {
            search: null
          },
          sort: 'createdAt:desc'
        },
        meta: {
          version: 'v2',
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  async findAll(
    @Query('offset') offset: number = 0,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('sort') sort: string = 'createdAt:desc',
    @Query('include') include?: string[]
  ): Promise<ApiResponseDto> {
    const result = await this.usersService.findAll(offset, limit, search, sort, include);
    
    return {
      success: true,
      message: '사용자 목록을 조회했습니다.',
      data: result,
      meta: {
        version: 'v2',
        timestamp: new Date(),
      },
      timestamp: new Date(),
    };
  }

  /**
   * 현재 로그인한 사용자 정보 조회
   * JWT 토큰에서 사용자 ID를 추출하여 조회
   */
  @Get('me')
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
    @Request() req: any,
    @Query('include') include?: string[]
  ): Promise<ApiResponseDto> {
    // JWT payload에서 sub (user id) 추출
    const userId = req.user.sub;
    const user = await this.usersService.findOne(userId, include);
    
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

  /**
   * 사용자 상세 조회 (V2 방식)
   * 관련 리소스 포함 옵션 지원
   */
  @Get(':id')
  @ApiOperation({ 
    summary: '사용자 상세 조회', 
    description: 'V2 방식 - 특정 사용자의 상세 정보를 조회합니다. 관련 리소스 포함 가능합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '사용자 ID' 
  })
  @ApiQuery({ 
    name: 'include', 
    required: false, 
    type: [String], 
    description: '포함할 관련 리소스 (예: fileUploads)' 
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
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('include') include?: string[]
  ): Promise<ApiResponseDto> {
    const user = await this.usersService.findOne(id, include);
    
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

  /**
   * 사용자 생성 (V2 방식)
   * 향상된 유효성 검사 및 표준화된 응답 형식
   */
  @Post()
  @ApiOperation({ 
    summary: '사용자 생성', 
    description: 'V2 방식 - 새로운 사용자를 생성합니다.' 
  })
  @ApiResponse({ 
    status: 201, 
    description: '사용자 생성 성공',
    schema: {
      example: {
        success: true,
        message: '사용자가 성공적으로 생성되었습니다.',
        data: {
          id: 1,
          email: 'user@example.com',
          nickname: 'user',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        meta: {
          version: 'v2',
          timestamp: '2024-01-01T00:00:00.000Z',
          message: '사용자가 성공적으로 생성되었습니다.'
        },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 409, 
    description: '이미 존재하는 이메일' 
  })
  async create(@Body() createUserDto: CreateUserDto): Promise<ApiResponseDto> {
    const user = await this.usersService.create(createUserDto);
    
    return {
      success: true,
      message: '사용자가 성공적으로 생성되었습니다.',
      data: user,
      meta: {
        version: 'v2',
        timestamp: new Date(),
        message: '사용자가 성공적으로 생성되었습니다.',
      },
      timestamp: new Date(),
    };
  }

  /**
   * 사용자 정보 수정 (V2 방식)
   * 표준화된 응답 형식
   */
  @Put(':id')
  @ApiOperation({ 
    summary: '사용자 정보 수정', 
    description: 'V2 방식 - 특정 사용자의 정보를 수정합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '사용자 ID' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 수정 성공' 
  })
  @ApiResponse({ 
    status: 404, 
    description: '사용자를 찾을 수 없음' 
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<ApiResponseDto> {
    const user = await this.usersService.update(id, updateUserDto);
    
    return {
      success: true,
      message: '사용자 정보가 성공적으로 수정되었습니다.',
      data: user,
      meta: {
        version: 'v2',
        timestamp: new Date(),
        message: '사용자 정보가 성공적으로 수정되었습니다.',
      },
      timestamp: new Date(),
    };
  }

  /**
   * 사용자 삭제 (V2 방식)
   * 표준화된 응답 형식
   */
  @Delete(':id')
  @ApiOperation({ 
    summary: '사용자 삭제', 
    description: 'V2 방식 - 특정 사용자를 삭제합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '사용자 ID' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 삭제 성공' 
  })
  @ApiResponse({ 
    status: 404, 
    description: '사용자를 찾을 수 없음' 
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
    await this.usersService.remove(id);
    
    return {
      success: true,
      message: '사용자가 성공적으로 삭제되었습니다.',
      meta: {
        version: 'v2',
        timestamp: new Date(),
        message: '사용자가 성공적으로 삭제되었습니다.',
      },
      timestamp: new Date(),
    };
  }
}