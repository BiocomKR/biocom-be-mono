import { Module } from '@nestjs/common';
import { StatisticsController } from './controllers/statistics.controller';
import { AiAgentStatisticsController } from './controllers/ai-agent-statistics.controller';
import { StatisticsService } from './services/statistics.service';
import { SibModule } from '../sib/sib.module';

/**
 * 통계 모듈
 * 6가지 기록 유형별 1주일 통계 기능 제공
 *
 * - 이너뷰티 (이너뷰티 + 아우터뷰티)
 * - 식단 (음식물과민식품, 고포드맵, 가공식품 분류)
 * - 영양제 (섭취 준수율)
 * - 간헐적단식 (16시간 목표 달성률)
 * - 수면 (8시간 목표 달성률)
 * - 활동 (칼로리 소모량, 전일 대비 증감)
 * - AI Agent 통계 (별도 인증 방식)
 */
@Module({
  imports: [SibModule],
  controllers: [StatisticsController, AiAgentStatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}