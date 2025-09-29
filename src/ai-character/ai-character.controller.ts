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
import { AiCharacterService } from './ai-character.service';
import {
  CreateAiCharacterDto,
  UpdateAiCharacterDto,
  AiCharacterResponseDto,
  AiCharacterListResponseDto
} from './dto/ai-character.dto';

@ApiTags('AI 캐릭터 관리')
@Controller('ai-characters')
export class AiCharacterController {
  constructor(private readonly aiCharacterService: AiCharacterService) {}

  /**
   * AI 캐릭터 생성
   * 관리자용 API
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AI 캐릭터 생성',
    description: '새로운 AI 캐릭터를 생성합니다. 관리자 권한이 필요합니다.'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'AI 캐릭터가 성공적으로 생성되었습니다',
    type: AiCharacterResponseDto
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '같은 이름의 캐릭터가 이미 존재합니다'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '잘못된 요청 데이터'
  })
  async createCharacter(@Body() createAiCharacterDto: CreateAiCharacterDto): Promise<AiCharacterResponseDto> {
    return this.aiCharacterService.createCharacter(createAiCharacterDto);
  }

  /**
   * 활성화된 AI 캐릭터 목록 조회
   * 일반 사용자도 접근 가능
   */
  @Get()
  @ApiOperation({
    summary: 'AI 캐릭터 목록 조회',
    description: '활성화된 AI 캐릭터 목록을 정렬 순서대로 조회합니다.'
  })
  @ApiQuery({
    name: 'admin',
    required: false,
    description: 'true인 경우 비활성화된 캐릭터도 포함하여 조회 (관리자용)',
    type: Boolean
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '캐릭터 목록 조회 성공',
    type: AiCharacterListResponseDto
  })
  async getCharacters(@Query('admin') isAdmin?: string): Promise<AiCharacterListResponseDto> {
    if (isAdmin === 'true') {
      return this.aiCharacterService.getAllCharactersForAdmin();
    }
    return this.aiCharacterService.getAllCharacters();
  }

  /**
   * AI 캐릭터 단일 조회
   */
  @Get(':id')
  @ApiParam({
    name: 'id',
    description: '캐릭터 ID',
    type: Number,
    example: 1
  })
  @ApiOperation({
    summary: 'AI 캐릭터 단일 조회',
    description: '특정 AI 캐릭터의 상세 정보를 조회합니다.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '캐릭터 조회 성공',
    type: AiCharacterResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '캐릭터를 찾을 수 없습니다'
  })
  async getCharacterById(@Param('id', ParseIntPipe) id: number): Promise<AiCharacterResponseDto> {
    return this.aiCharacterService.getCharacterById(id);
  }

  /**
   * AI 캐릭터 수정
   * 관리자용 API
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    description: '캐릭터 ID',
    type: Number,
    example: 1
  })
  @ApiOperation({
    summary: 'AI 캐릭터 수정',
    description: 'AI 캐릭터의 정보를 수정합니다. 관리자 권한이 필요합니다.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '캐릭터 수정 성공',
    type: AiCharacterResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '캐릭터를 찾을 수 없습니다'
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '같은 이름의 캐릭터가 이미 존재합니다'
  })
  async updateCharacter(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAiCharacterDto: UpdateAiCharacterDto
  ): Promise<AiCharacterResponseDto> {
    return this.aiCharacterService.updateCharacter(id, updateAiCharacterDto);
  }

  /**
   * AI 캐릭터 삭제 (소프트 삭제)
   * 관리자용 API
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    description: '캐릭터 ID',
    type: Number,
    example: 1
  })
  @ApiOperation({
    summary: 'AI 캐릭터 삭제',
    description: 'AI 캐릭터를 삭제합니다 (소프트 삭제). 사용 중인 캐릭터는 삭제할 수 없습니다.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '캐릭터 삭제 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: "캐릭터 '철민님'이 성공적으로 삭제되었습니다" }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '캐릭터를 찾을 수 없습니다'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '사용 중인 캐릭터는 삭제할 수 없습니다'
  })
  async deleteCharacter(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean; message: string }> {
    return this.aiCharacterService.deleteCharacter(id);
  }
}