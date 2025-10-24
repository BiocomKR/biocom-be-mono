import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpStatus,
  Query
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
import { ManagerGuard } from '../common/guards/manager.guard';
import { AiPersonaService } from './ai-persona.service';
import {
  CreateAiPersonaDto,
  UpdateAiPersonaDto,
  AiPersonaResponseDto,
  AiPersonaListResponseDto
} from './dto/ai-persona.dto';

@ApiTags('AI 페르소나 관리')
@Controller('ai-personas')
export class AiPersonaController {
  constructor(private readonly aiPersonaService: AiPersonaService) {}

  /**
   * AI 페르소나 생성
   * 관리자용 API
   */
  @Post()
  @UseGuards(JwtAuthGuard, ManagerGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AI 페르소나 생성',
    description: '새로운 AI 페르소나를 생성합니다. 관리자 권한이 필요합니다.'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'AI 페르소나가 성공적으로 생성되었습니다',
    type: AiPersonaResponseDto
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '같은 이름의 페르소나가 이미 존재합니다'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '잘못된 요청 데이터'
  })
  async createPersona(@Body() createAiPersonaDto: CreateAiPersonaDto): Promise<AiPersonaResponseDto> {
    return this.aiPersonaService.createPersona(createAiPersonaDto);
  }

  /**
   * 활성화된 AI 페르소나 목록 조회
   * 일반 사용자도 접근 가능
   */
  @Get()
  @ApiOperation({
    summary: 'AI 페르소나 목록 조회',
    description: '활성화된 AI 페르소나 목록을 정렬 순서대로 조회합니다.'
  })
  @ApiQuery({
    name: 'admin',
    required: false,
    description: 'true인 경우 비활성화된 페르소나도 포함하여 조회 (관리자용)',
    type: Boolean
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '페르소나 목록 조회 성공',
    type: AiPersonaListResponseDto
  })
  async getPersonas(@Query('admin') isAdmin?: string): Promise<AiPersonaListResponseDto> {
    if (isAdmin === 'true') {
      return this.aiPersonaService.getAllPersonasForAdmin();
    }
    return this.aiPersonaService.getAllPersonas();
  }

  /**
   * AI 페르소나 단일 조회
   */
  @Get(':id')
  @ApiParam({
    name: 'id',
    description: '페르소나 ID',
    type: Number,
    example: 1
  })
  @ApiOperation({
    summary: 'AI 페르소나 단일 조회',
    description: '특정 AI 페르소나의 상세 정보를 조회합니다.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '페르소나 조회 성공',
    type: AiPersonaResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '페르소나를 찾을 수 없습니다'
  })
  async getPersonaById(@Param('id', ParseIntPipe) id: number): Promise<AiPersonaResponseDto> {
    return this.aiPersonaService.getPersonaById(id);
  }

  /**
   * AI 페르소나 수정
   * 관리자용 API
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, ManagerGuard)
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    description: '페르소나 ID',
    type: Number,
    example: 1
  })
  @ApiOperation({
    summary: 'AI 페르소나 수정',
    description: 'AI 페르소나의 정보를 수정합니다. 관리자 권한이 필요합니다.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '페르소나 수정 성공',
    type: AiPersonaResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '페르소나를 찾을 수 없습니다'
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '같은 이름의 페르소나가 이미 존재합니다'
  })
  async updatePersona(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAiPersonaDto: UpdateAiPersonaDto
  ): Promise<AiPersonaResponseDto> {
    return this.aiPersonaService.updatePersona(id, updateAiPersonaDto);
  }

  /**
   * AI 페르소나 삭제 (소프트 삭제)
   * 관리자용 API
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, ManagerGuard)
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    description: '페르소나 ID',
    type: Number,
    example: 1
  })
  @ApiOperation({
    summary: 'AI 페르소나 삭제',
    description: 'AI 페르소나를 삭제합니다 (소프트 삭제). 사용 중인 페르소나는 삭제할 수 없습니다.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '페르소나 삭제 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: "페르소나 '철민님'이 성공적으로 삭제되었습니다" }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '페르소나를 찾을 수 없습니다'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '사용 중인 페르소나는 삭제할 수 없습니다'
  })
  async deletePersona(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean; message: string }> {
    return this.aiPersonaService.deletePersona(id);
  }
}
