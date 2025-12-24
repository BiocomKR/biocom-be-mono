import { Injectable, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/services/prisma.service';
import { AiChatRequestDto, AiAgentRequestDto, AiAgentResponseDto, AiChatResponseDto } from './dto/ai-chat.dto';
import axios, { AxiosError } from 'axios';

/**
 * AI 챗봇 서비스
 * AI Agent 서버와의 통신을 중계하는 서비스
 *
 * 주요 기능:
 * - 사용자 인증 정보 확인
 * - user_charts 테이블에서 chart_id 조회
 * - users 테이블에서 ai_persona_id 조회
 * - AI Agent 서버로 요청 전달 및 응답 반환
 */
@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly aiAgentBaseUrl: string;
  private readonly aiAgentApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // AI Agent 서버 설정 로드
    this.aiAgentBaseUrl = this.configService.get<string>('AI_AGENT_BASE_URL') || 'http://localhost:8000';
    this.aiAgentApiKey = this.configService.get<string>('AI_AGENT_API_KEY') || '';

    this.logger.log(`AI Agent Base URL: ${this.aiAgentBaseUrl}`);
  }

  /**
   * 알러지 관련 AI 채팅 처리
   *
   * @param userId 사용자 ID (JWT에서 추출)
   * @param dto 채팅 요청 DTO
   * @returns AI 응답 DTO
   *
   * 처리 과정:
   * 1. user_charts 테이블에서 chart_id 조회 (order_code IN ('D0060', 'D0004'))
   * 2. users 테이블에서 ai_persona_id 조회
   * 3. AI Agent 서버로 요청 전송
   * 4. 응답을 프론트엔드용 DTO로 변환하여 반환
   */
  async chatAllergy(userId: number, dto: AiChatRequestDto): Promise<AiChatResponseDto> {
    this.logger.log(`[chatAllergy] 시작 - userId: ${userId}`);

    // 1. chart_id 조회 (알러지/대사 검사 결과)
    const chartId = await this.getLatestChartId(userId);
    this.logger.log(`[chatAllergy] chartId 조회 완료: ${chartId}`);

    // 2. ai_persona_id 조회
    const personaId = await this.getPersonaId(userId);
    this.logger.log(`[chatAllergy] personaId 조회 완료: ${personaId}`);

    // 3. AI Agent 서버로 요청 전송
    const aiAgentRequest: AiAgentRequestDto = {
      userId,
      chartId,
      message: dto.message,
      personaId,
    };

    const aiAgentResponse = await this.callAiAgent('/api/chat/allergy', aiAgentRequest);
    this.logger.log(`[chatAllergy] AI Agent 응답 수신 - processing_time_ms: ${aiAgentResponse.processing_time_ms}`);

    // 4. 응답 변환 및 반환
    return {
      aiMessage: aiAgentResponse.ai_message,
      chartId: aiAgentResponse.chart_id,
      processingTimeMs: aiAgentResponse.processing_time_ms,
    };
  }

  /**
   * 사용자의 최신 chart_id 조회
   * order_code가 'D0060' 또는 'D0004'인 차트 중 가장 최근 것
   *
   * @param userId 사용자 ID
   * @returns chart_id
   * @throws BadRequestException chart_id가 없는 경우
   */
  private async getLatestChartId(userId: number): Promise<string> {
    const userChart = await this.prisma.userChart.findFirst({
      where: {
        userId,
        orderCode: {
          in: ['D0060', 'D0004'],
        },
      },
      orderBy: {
        receiptDate: 'desc',
      },
      select: {
        chartId: true,
      },
    });

    if (!userChart) {
      this.logger.warn(`[getLatestChartId] chart_id 없음 - userId: ${userId}`);
      throw new BadRequestException('검사 결과(chart_id)가 없습니다. 먼저 검사를 완료해주세요.');
    }

    return userChart.chartId;
  }

  /**
   * 사용자의 AI 페르소나 ID 조회
   *
   * @param userId 사용자 ID
   * @returns ai_persona_id
   * @throws BadRequestException ai_persona_id가 없는 경우
   */
  private async getPersonaId(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { aiPersonaId: true },
    });

    if (!user || user.aiPersonaId === null) {
      this.logger.warn(`[getPersonaId] ai_persona_id 없음 - userId: ${userId}`);
      throw new BadRequestException('AI 페르소나가 설정되지 않았습니다. 먼저 페르소나를 선택해주세요.');
    }

    return user.aiPersonaId;
  }

  /**
   * AI Agent 서버 호출
   *
   * @param endpoint API 엔드포인트 (예: /api/chat/allergy)
   * @param requestBody 요청 바디
   * @returns AI Agent 응답
   * @throws HttpException AI Agent 서버 에러 시
   */
  private async callAiAgent(endpoint: string, requestBody: AiAgentRequestDto): Promise<AiAgentResponseDto> {
    const url = `${this.aiAgentBaseUrl}${endpoint}`;

    this.logger.log(`[callAiAgent] 요청 URL: ${url}`);
    this.logger.debug(`[callAiAgent] 요청 바디: ${JSON.stringify(requestBody)}`);

    try {
      const response = await axios.post<AiAgentResponseDto>(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-api-key': this.aiAgentApiKey,
        },
        timeout: 30000, // 30초 타임아웃 (AI 응답 시간 고려)
      });

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(`[callAiAgent] AI Agent 서버 에러: ${error.message}`);
        this.logger.error(`[callAiAgent] 상태 코드: ${error.response?.status}`);
        this.logger.error(`[callAiAgent] 응답 데이터: ${JSON.stringify(error.response?.data)}`);

        // AI Agent 서버 에러를 클라이언트에 전달
        const status = error.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
        const message = error.response?.data?.detail || 'AI 서버와 통신 중 오류가 발생했습니다.';

        throw new HttpException(message, status);
      }

      // 예상치 못한 에러
      this.logger.error(`[callAiAgent] 예상치 못한 에러: ${error}`);
      throw new HttpException('AI 서버와 통신 중 오류가 발생했습니다.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
