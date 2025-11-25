import { Module } from '@nestjs/common';
import { QnaController } from './controllers/qna.controller';
import { QnaService } from './services/qna.service';
import { PrismaService } from '../common/services/prisma.service';

/**
 * 상품 Q&A 모듈
 * 상품에 대한 고객 질문 및 관리자 답변 기능 제공
 */
@Module({
  controllers: [QnaController],
  providers: [QnaService, PrismaService],
  exports: [QnaService]
})
export class QnaModule {}
