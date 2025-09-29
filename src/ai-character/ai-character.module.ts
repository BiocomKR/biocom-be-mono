import { Module } from '@nestjs/common';
import { AiCharacterController } from './ai-character.controller';
import { AiCharacterService } from './ai-character.service';
import { CommonModule } from '../common/common.module';

/**
 * AI 캐릭터 관리 모듈
 *
 * 기능:
 * - AI 캐릭터 CRUD 관리
 * - 캐릭터별 대화 스타일 설정
 * - 밸런스게임 연동을 위한 캐릭터 데이터 제공
 *
 * API 엔드포인트:
 * - GET /api/ai-characters - 캐릭터 목록 조회
 * - GET /api/ai-characters/:id - 캐릭터 단일 조회
 * - POST /api/ai-characters - 캐릭터 생성 (관리자)
 * - PUT /api/ai-characters/:id - 캐릭터 수정 (관리자)
 * - DELETE /api/ai-characters/:id - 캐릭터 삭제 (관리자)
 */
@Module({
  imports: [CommonModule],
  controllers: [AiCharacterController],
  providers: [AiCharacterService],
  exports: [AiCharacterService]
})
export class AiCharacterModule {}