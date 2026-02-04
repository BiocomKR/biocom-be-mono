import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { DiskHealthIndicator } from './indicators/disk.health';
import { MemoryHealthIndicator } from './indicators/memory.health';
import { PrismaService } from '../common/services/prisma.service';
import { QueuesModule } from '../queues/queues.module';

/**
 * Health Check 모듈
 * 시스템 상태를 모니터링하고 건강 상태를 확인
 *
 * 체크 항목:
 * - 데이터베이스 연결 상태
 * - 디스크 사용량
 * - 메모리 사용량
 * - 애플리케이션 가동 시간
 */
@Module({
  imports: [TerminusModule, HttpModule, QueuesModule],
  controllers: [HealthController],
  providers: [
    PrismaHealthIndicator,
    DiskHealthIndicator,
    MemoryHealthIndicator,
    PrismaService,
  ],
})
export class HealthModule {}
