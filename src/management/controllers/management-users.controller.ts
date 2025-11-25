import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ManagementUsersService } from '../services/management-users.service';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * Management 사용자 관리 컨트롤러
 * 백오피스에서 사용자 정보를 관리하는 API
 */
@Controller('management/users')
@UseGuards(ApiKeyGuard)
export class ManagementUsersController {
  private readonly logger = new Logger(ManagementUsersController.name);

  constructor(private readonly usersService: ManagementUsersService) {}

  /**
   * 사용자 목록 조회
   */
  @Get()
  async findAll(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy: string = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`사용자 목록 조회 - 페이지: ${page}, 검색어: ${search}`);

    const offset = (page - 1) * limit;
    const sort = `${sortBy}:${sortOrder}`;

    const result = await this.usersService.findAll(offset, limit, search, sort);

    return {
      success: true,
      message: '사용자 목록이 성공적으로 조회되었습니다.',
      data: {
        users: result.items,
        total: result.pagination.total,
        page,
        limit,
      },
      timestamp: getNowKST(),
    };
  }

  /**
   * 특정 사용자 조회
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto<any>> {
    this.logger.log(`특정 사용자 조회 - ID: ${id}`);

    const user = await this.usersService.findOne(id);

    return {
      success: true,
      message: '사용자 정보가 성공적으로 조회되었습니다.',
      data: user,
      timestamp: getNowKST(),
    };
  }

  /**
   * 사용자 생성
   */
  @Post()
  async create(
    @Body() createUserDto: {
      email: string;
      password: string;
      name: string;
      mobile?: string;
    }
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`사용자 생성 - 이메일: ${createUserDto.email}`);

    const user = await this.usersService.create(createUserDto);

    return {
      success: true,
      message: '사용자가 성공적으로 생성되었습니다.',
      data: user,
      timestamp: getNowKST(),
    };
  }

  /**
   * 사용자 정보 수정
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: {
      email?: string;
      password?: string;
      name?: string;
      mobile?: string;
      aiPersonaId?: number;
    },
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`사용자 수정 - ID: ${id}`);

    const user = await this.usersService.update(id, updateUserDto);

    return {
      success: true,
      message: '사용자 정보가 성공적으로 수정되었습니다.',
      data: user,
      timestamp: getNowKST(),
    };
  }

  /**
   * 사용자 삭제
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto<void>> {
    this.logger.log(`사용자 삭제 - ID: ${id}`);

    await this.usersService.remove(id);

    return {
      success: true,
      message: '사용자가 성공적으로 삭제되었습니다.',
      data: undefined,
      timestamp: getNowKST(),
    };
  }
}
