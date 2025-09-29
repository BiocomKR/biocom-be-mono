import { Module } from '@nestjs/common';
import { BalanceGameController } from './controllers/balance-game.controller';
import { BalanceGameService } from './services/balance-game.service';
import { PrismaService } from '../common/services/prisma.service';

/**
 * 밸런스게임 모듈
 * 매일 새로운 밸런스게임 제공 및 뱃지/쿠폰 보상 시스템
 */
@Module({
  controllers: [BalanceGameController],
  providers: [BalanceGameService, PrismaService],
  exports: [BalanceGameService]
})
export class BalanceGameModule {}