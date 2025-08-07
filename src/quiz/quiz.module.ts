import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { QuizMasterService } from './quiz-master.service';

/**
 * 퀴즈 모듈
 * 퀴즈 마스터 데이터 관리
 */
@Module({
  imports: [CommonModule],
  providers: [QuizMasterService],
  exports: [QuizMasterService],
})
export class QuizModule {}