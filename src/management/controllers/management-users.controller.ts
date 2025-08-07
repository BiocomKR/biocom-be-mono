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
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { UsersService } from '../../users/users.service';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { ApiSuccessResponse } from '../../common/dto/api-response.dto';

/**
 * Management 사용자 관리 컨트롤러
 * 백오피스에서 사용자 정보를 관리하는 API
 */
@ApiTags('management-users')
@Controller('management/users')
@UseGuards(ApiKeyGuard)
@ApiHeader({
  name: 'X-API-KEY',
  description: 'API Key for authentication',
  required: true,
})
export class ManagementUsersController {
  private readonly logger = new Logger(ManagementUsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * 사용자 목록 조회
   */
  @Get()
  @ApiOperation({
    summary: '사용자 목록 조회',
    description: '사용자 목록을 페이징, 필터, 정렬 옵션과 함께 조회합니다.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '페이지 번호', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지당 항목 수', example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String, description: '검색어 (이름, 이메일, 전화번호)' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: '정렬 기준', example: 'createdAt' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: '정렬 순서', example: 'desc' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '사용자 목록 조회 성공',
  })
  async findAll(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy: string = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<ApiSuccessResponse<{ users: UserResponseDto[]; total: number; page: number; limit: number }>> {
    this.logger.log(`사용자 목록 조회 - 페이지: ${page}, 검색어: ${search}`);

    // offset 계산
    const offset = (page - 1) * limit;
    const sort = `${sortBy}:${sortOrder}`;

    const result = await this.usersService.findAll(
      offset,
      limit,
      search,
      sort,
    );

    // V2 응답을 management API 응답 형식으로 변환
    const users: UserResponseDto[] = result.items.map(user => ({
      id: user.id,
      email: user.email,
      nickname: user.name,
      name: user.name,
      mobile: user.mobile,
      points: user.points,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    return {
      success: true,
      message: '사용자 목록이 성공적으로 조회되었습니다.',
      data: {
        users,
        total: result.pagination.total,
        page,
        limit,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 특정 사용자 조회
   */
  @Get(':id')
  @ApiOperation({
    summary: '특정 사용자 조회',
    description: '사용자 ID로 특정 사용자의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'id', type: Number, description: '사용자 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '사용자 조회 성공',
    type: UserResponseDto,
  })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiSuccessResponse<UserResponseDto>> {
    this.logger.log(`특정 사용자 조회 - ID: ${id}`);

    const user = await this.usersService.findOne(id);

    return {
      success: true,
      message: '사용자 정보가 성공적으로 조회되었습니다.',
      data: user,
      timestamp: new Date(),
    };
  }

  /**
   * 사용자 생성
   */
  @Post()
  @ApiOperation({
    summary: '사용자 생성',
    description: '새로운 사용자를 생성합니다.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '사용자 생성 성공',
    type: UserResponseDto,
  })
  async create(@Body() createUserDto: CreateUserDto): Promise<ApiSuccessResponse<UserResponseDto>> {
    this.logger.log(`사용자 생성 - 이메일: ${createUserDto.email}`);

    const user = await this.usersService.create(createUserDto);

    return {
      success: true,
      message: '사용자가 성공적으로 생성되었습니다.',
      data: user,
      timestamp: new Date(),
    };
  }

  /**
   * 사용자 정보 수정
   */
  @Put(':id')
  @ApiOperation({
    summary: '사용자 정보 수정',
    description: '사용자의 정보를 수정합니다.',
  })
  @ApiParam({ name: 'id', type: Number, description: '사용자 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '사용자 수정 성공',
    type: UserResponseDto,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ApiSuccessResponse<UserResponseDto>> {
    this.logger.log(`사용자 수정 - ID: ${id}`);

    const user = await this.usersService.update(id, updateUserDto);

    return {
      success: true,
      message: '사용자 정보가 성공적으로 수정되었습니다.',
      data: user,
      timestamp: new Date(),
    };
  }

  /**
   * 사용자 삭제
   */
  @Delete(':id')
  @ApiOperation({
    summary: '사용자 삭제',
    description: '사용자를 삭제합니다.',
  })
  @ApiParam({ name: 'id', type: Number, description: '사용자 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '사용자 삭제 성공',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<ApiSuccessResponse<void>> {
    this.logger.log(`사용자 삭제 - ID: ${id}`);

    await this.usersService.remove(id);

    return {
      success: true,
      message: '사용자가 성공적으로 삭제되었습니다.',
      data: undefined,
      timestamp: new Date(),
    };
  }
}