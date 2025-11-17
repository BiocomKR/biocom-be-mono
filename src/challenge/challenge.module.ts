import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ChallengeController } from './challenge.controller';
import { ChallengeService } from './challenge.service';
import { ChallengeSchedulerService } from './challenge-scheduler.service';

/**
 * 챌린지 모듈
 * 핵심 챌린지 관련 기능들을 제공합니다
 */
@Module({
  imports: [CommonModule],
  controllers: [ChallengeController],
  providers: [ChallengeService, ChallengeSchedulerService],
  exports: [ChallengeService, ChallengeSchedulerService]
})
export class ChallengeModule {}