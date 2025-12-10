import { Module } from '@nestjs/common';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { SibModule } from '../sib/sib.module';
import { CommonModule } from '../common/common.module';

/**
 * 검사 모듈
 * - SIB API를 통한 검사 결과 조회
 * - /api/exam/report/... 엔드포인트 제공
 */
@Module({
  imports: [SibModule, CommonModule],
  controllers: [ExamController],
  providers: [ExamService],
})
export class ExamModule {}
