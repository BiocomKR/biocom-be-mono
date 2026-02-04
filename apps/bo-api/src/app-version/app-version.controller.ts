/**
 * 앱 버전 관리 컨트롤러 (백오피스)
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AppVersionService } from './app-version.service';
import {
  CreateAppVersionDto,
  UpdateAppVersionDto,
  AppVersionQueryDto,
} from './dto/app-version.dto';

@ApiTags('앱 버전 관리')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('app-versions')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @Get()
  @ApiOperation({ summary: '앱 버전 목록 조회' })
  async findAll(@Query() query: AppVersionQueryDto) {
    return this.appVersionService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '앱 버전 상세 조회' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.appVersionService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '앱 버전 등록' })
  async create(@Body() dto: CreateAppVersionDto) {
    return this.appVersionService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '앱 버전 수정' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppVersionDto,
  ) {
    return this.appVersionService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '앱 버전 삭제' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.appVersionService.remove(id);
  }
}
