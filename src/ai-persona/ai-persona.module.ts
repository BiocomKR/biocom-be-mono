import { Module } from '@nestjs/common';
import { AiPersonaController } from './ai-persona.controller';
import { AiPersonaService } from './ai-persona.service';
import { CommonModule } from '../common/common.module';

/**
 * AI 페르소나 관리 모듈
 *
 * 기능:
 * - AI 페르소나 CRUD 관리
 * - 페르소나별 대화 스타일 설정
 * - 밸런스게임 연동을 위한 페르소나 데이터 제공
 *
 * API 엔드포인트:
 * - GET /api/ai-personas - 페르소나 목록 조회
 * - GET /api/ai-personas/:id - 페르소나 단일 조회
 * - POST /api/ai-personas - 페르소나 생성 (관리자)
 * - PUT /api/ai-personas/:id - 페르소나 수정 (관리자)
 * - DELETE /api/ai-personas/:id - 페르소나 삭제 (관리자)
 */
@Module({
  imports: [CommonModule],
  controllers: [AiPersonaController],
  providers: [AiPersonaService],
  exports: [AiPersonaService]
})
export class AiPersonaModule {}
