import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OperatorsService } from './operators.service';
import { CreateOperatorDto } from './dto/create-operator.dto';
import { UpdateOperatorDto } from './dto/update-operator.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../common/guards/system-only.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 운영자 관리 컨트롤러
 * SYSTEM 등급만 접근 가능
 */
@ApiTags('운영자 관리')
@Controller('operators')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
@ApiBearerAuth()
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  /**
   * 운영자 생성
   */
  @Post()
  @ApiOperation({
    summary: '운영자 생성',
    description: '새로운 운영자를 생성합니다. (SYSTEM 전용)',
  })
  @ApiResponse({ status: 201, description: '운영자 생성 성공' })
  @ApiResponse({ status: 403, description: 'SYSTEM 권한 필요' })
  @ApiResponse({ status: 409, description: '이미 존재하는 이메일' })
  async create(@Body() dto: CreateOperatorDto): Promise<ApiResponseDto> {
    const result = await this.operatorsService.create(dto);

    return {
      success: true,
      message: '운영자가 생성되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 운영자 목록 조회
   */
  @Get()
  @ApiOperation({
    summary: '운영자 목록 조회',
    description: '모든 운영자 목록을 조회합니다. (SYSTEM 전용)',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 403, description: 'SYSTEM 권한 필요' })
  async findAll(): Promise<ApiResponseDto> {
    const result = await this.operatorsService.findAll();

    return {
      success: true,
      message: '운영자 목록 조회 성공',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 운영자 상세 조회
   */
  @Get(':id')
  @ApiOperation({
    summary: '운영자 상세 조회',
    description: '특정 운영자의 상세 정보를 조회합니다. (SYSTEM 전용)',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 403, description: 'SYSTEM 권한 필요' })
  @ApiResponse({ status: 404, description: '운영자를 찾을 수 없음' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
    const result = await this.operatorsService.findOne(id);

    return {
      success: true,
      message: '운영자 조회 성공',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 운영자 수정
   */
  @Patch(':id')
  @ApiOperation({
    summary: '운영자 수정',
    description: '운영자 정보를 수정합니다. (SYSTEM 전용)',
  })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 403, description: 'SYSTEM 권한 필요' })
  @ApiResponse({ status: 404, description: '운영자를 찾을 수 없음' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperatorDto,
  ): Promise<ApiResponseDto> {
    const result = await this.operatorsService.update(id, dto);

    return {
      success: true,
      message: '운영자 정보가 수정되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 운영자 비활성화
   */
  @Delete(':id')
  @ApiOperation({
    summary: '운영자 비활성화',
    description: '운영자를 비활성화합니다. (SYSTEM 전용)',
  })
  @ApiResponse({ status: 200, description: '비활성화 성공' })
  @ApiResponse({ status: 403, description: 'SYSTEM 권한 필요' })
  @ApiResponse({ status: 404, description: '운영자를 찾을 수 없음' })
  async deactivate(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
    const result = await this.operatorsService.deactivate(id);

    return {
      success: true,
      message: result.message,
      data: null,
      timestamp: getNowKST(),
    };
  }

  /**
   * 계정 잠금 해제
   */
  @Post(':id/unlock')
  @ApiOperation({
    summary: '계정 잠금 해제',
    description: '잠긴 운영자 계정의 잠금을 해제합니다. (SYSTEM 전용)',
  })
  @ApiResponse({ status: 200, description: '잠금 해제 성공' })
  @ApiResponse({ status: 403, description: 'SYSTEM 권한 필요' })
  @ApiResponse({ status: 404, description: '운영자를 찾을 수 없음' })
  async unlock(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
    const result = await this.operatorsService.unlock(id);

    return {
      success: true,
      message: result.message,
      data: null,
      timestamp: getNowKST(),
    };
  }
}
