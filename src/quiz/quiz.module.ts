import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { QuizMasterService } from './quiz-master.service';
// import { QuizCompletionController } from './quiz-completion.controller';
// import { QuizCompletionService } from './quiz-completion.service';

/**
 * 퀴즈 모듈
 * 퀴즈 마스터 데이터 관리 및 사용자 퀴즈 완료
 */
@Module({
  imports: [CommonModule],
  controllers: [], // QuizCompletionController 임시 제거
  providers: [QuizMasterService], // QuizCompletionService 임시 제거
  exports: [QuizMasterService],
})
export class QuizModule {}