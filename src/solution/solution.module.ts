import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { SolutionController } from './solution.controller';
import { SolutionService } from './solution.service';

/**
 * 맞춤 솔루션 모듈
 * 건강유형별 영양제/식단 추천 기능 제공
 */
@Module({
  imports: [CommonModule],
  controllers: [SolutionController],
  providers: [SolutionService],
  exports: [SolutionService],
})
export class SolutionModule {}
