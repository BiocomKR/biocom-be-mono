import {
  Controller,
  Get,
  Put,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UserQueryDto } from './dto/user-query.dto';
import { UserListResponseDto, UserDetailResponseDto, UserStatsResponseDto } from './dto/user-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 회원 관리 컨트롤러
 * 백오피스에서 회원 정보를 관리하는 API
 */
@ApiTags('회원 관리')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * 회원 통계 조회
   */
  @Get('stats')
  @ApiOperation({ summary: '회원 통계 조회' })
  @ApiResponse({ status: 200, type: UserStatsResponseDto })
  async getStats(): Promise<UserStatsResponseDto> {
    this.logger.log('회원 통계 조회');

    const stats = await this.usersService.getStats();

    return {
      success: true,
      message: '회원 통계가 조회되었습니다.',
      data: stats,
      timestamp: getNowKST(),
    };
  }

  /**
   * 회원 목록 조회
   */
  @Get()
  @ApiOperation({ summary: '회원 목록 조회' })
  @ApiResponse({ status: 200, type: UserListResponseDto })
  async findAll(@Query() query: UserQueryDto): Promise<UserListResponseDto> {
    this.logger.log(`회원 목록 조회 - 페이지: ${query.page}, 검색어: ${query.search}`);

    const result = await this.usersService.findAll(query);

    return {
      success: true,
      message: '회원 목록이 조회되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 회원 상세 조회
   */
  @Get(':id')
  @ApiOperation({ summary: '회원 상세 조회' })
  @ApiResponse({ status: 200, type: UserDetailResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserDetailResponseDto> {
    this.logger.log(`회원 상세 조회 - ID: ${id}`);

    const user = await this.usersService.findOne(id);

    return {
      success: true,
      message: '회원 정보가 조회되었습니다.',
      data: user,
      timestamp: getNowKST(),
    };
  }

  /**
   * 회원 정보 수정
   */
  @Put(':id')
  @ApiOperation({ summary: '회원 정보 수정' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: {
      email?: string;
      name?: string;
      mobile?: string;
      status?: string;
      isActive?: boolean;
      points?: number;
    },
  ) {
    this.logger.log(`회원 정보 수정 - ID: ${id}`);

    const user = await this.usersService.update(id, updateUserDto);

    return {
      success: true,
      message: '회원 정보가 수정되었습니다.',
      data: user,
      timestamp: getNowKST(),
    };
  }

  /**
   * 회원 삭제 (소프트 삭제)
   */
  @Delete(':id')
  @ApiOperation({ summary: '회원 삭제' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`회원 삭제 - ID: ${id}`);

    await this.usersService.remove(id);

    return {
      success: true,
      message: '회원이 삭제되었습니다.',
      timestamp: getNowKST(),
    };
  }

  /**
   * 회원 복구
   */
  @Patch(':id/restore')
  @ApiOperation({ summary: '삭제된 회원 복구' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`회원 복구 - ID: ${id}`);

    const result = await this.usersService.restore(id);

    return {
      success: true,
      message: result.message,
      timestamp: getNowKST(),
    };
  }
}
