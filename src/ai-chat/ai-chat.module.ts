import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { CommonModule } from '../common/common.module';

/**
 * AI 챗봇 모듈
 *
 * AI Agent 서버와의 통신을 중계하는 API 모듈
 *
 * 기능:
 * - 알러지 관련 AI 채팅 (POST /api/chat/allergy)
 * - 사용자의 chart_id, persona_id 자동 조회
 * - AI Agent 서버로 요청 전달 및 응답 반환
 *
 * 의존성:
 * - CommonModule: PrismaService (DB 조회)
 * - HttpModule: axios 기반 HTTP 클라이언트
 */
@Module({
  imports: [
    CommonModule,
    HttpModule.register({
      timeout: 30000, // 30초 타임아웃
      maxRedirects: 5,
    }),
  ],
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
