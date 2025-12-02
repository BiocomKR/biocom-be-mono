/**
 * GraphDB 동기화 모듈
 *
 * @description
 * - BullMQ Producer 역할 (biocom-api → biocom-mq)
 * - 총 10개 Queue 등록 및 관리
 * - Fire-and-Forget 패턴으로 비동기 처리
 *
 * @architecture
 * - biocom-api (Producer) → Redis → biocom-mq (Consumer) → Neo4j GraphDB
 *
 * @author Claude Code
 * @date 2025-12-01
 */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GraphSyncService } from './graph-sync.service';

/**
 * Queue 이름 목록 (10개)
 *
 * NOTE: biocom-mq Consumer와 일치해야 함
 * - Queue 이름: graph-sync-* 형식
 * - Job 이름: 모두 'sync'로 통일
 */
const QUEUE_NAMES = [
  'graph-sync-user',
  'graph-sync-beauty',
  'graph-sync-food',
  'graph-sync-fasting',
  'graph-sync-sleep',
  'graph-sync-activity',
  'graph-sync-allergy',
  'graph-sync-mission',
  'graph-sync-balance-game',
  'graph-sync-supplement',
];

@Module({
  imports: [
    // 10개 Queue 일괄 등록 (환경변수 기반 Redis 연결)
    ...QUEUE_NAMES.map((queueName) =>
      BullModule.registerQueue({
        name: queueName,
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    ),
  ],
  providers: [GraphSyncService],
  exports: [GraphSyncService],
})
export class GraphSyncModule {}
