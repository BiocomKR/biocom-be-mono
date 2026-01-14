import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { QuizCompletionController } from './quiz-completion.controller';
import { QuizCompletionService } from './quiz-completion.service';
import { PointModule } from '../point/point.module';

/**
 * 퀴즈 모듈
 * 퀴즈 마스터 데이터 관리 및 사용자 퀴즈 완료
 */
@Module({
  imports: [CommonModule, PointModule],
  controllers: [QuizCompletionController],
  providers: [QuizCompletionService],
  exports: [QuizCompletionService],
})
export class QuizModule {}