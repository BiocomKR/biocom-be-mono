import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';
import { AiChatRequestDto, AiChatResponseDto } from './dto/ai-chat.dto';

/**
 * AI 챗봇 컨트롤러
 * AI Agent 서버와의 통신을 중계하는 API
 *
 * 엔드포인트:
 * - POST /api/chat/allergy - 알러지 관련 AI 채팅
 */
@ApiTags('AI 챗봇')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  /**
   * 알러지 관련 AI 채팅
   *
   * 처리 과정:
   * 1. JWT에서 userId 추출
   * 2. user_charts에서 chart_id 조회
   * 3. users에서 ai_persona_id 조회
   * 4. AI Agent 서버로 요청 전달
   * 5. 응답 반환
   */
  @Post('allergy')
  @ApiOperation({
    summary: '알러지 AI 채팅',
    description: `
알러지 관련 AI 챗봇과 대화합니다.

**필요 조건:**
- 사용자에게 검사 결과(chart_id)가 있어야 합니다 (order_code: D0060 또는 D0004)
- 사용자에게 AI 페르소나가 설정되어 있어야 합니다

**처리 흐름:**
1. JWT 토큰에서 사용자 ID 추출
2. user_charts 테이블에서 최신 chart_id 조회
3. users 테이블에서 ai_persona_id 조회
4. AI Agent 서버로 요청 전달
5. AI 응답 반환
    `,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI 응답 성공',
    type: AiChatResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'chart_id 또는 ai_persona_id가 없는 경우',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '인증되지 않은 요청',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'AI Agent 서버 오류',
  })
  async chatAllergy(
    @Request() req,
    @Body() dto: AiChatRequestDto,
  ): Promise<AiChatResponseDto> {
    // JWT payload에서 sub (user id) 추출
    const userId = req.user.sub;
    return this.aiChatService.chatAllergy(userId, dto);
  }
}
