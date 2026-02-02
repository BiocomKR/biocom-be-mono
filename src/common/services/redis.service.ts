import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 서비스
 *
 * 분산락 등 Redis 직접 사용이 필요한 경우 사용
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis 연결 오류: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis 연결 성공');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * 분산락 획득
   *
   * @param key 락 키
   * @param ttlMs 락 만료 시간 (밀리초)
   * @returns 락 획득 성공 여부
   */
  async acquireLock(key: string, ttlMs: number = 30000): Promise<boolean> {
    const result = await this.client.set(key, '1', 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  /**
   * 분산락 해제
   *
   * @param key 락 키
   */
  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * 키 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * 중복 발송 방지를 위한 마킹
   *
   * @param key 마킹 키
   * @param ttlMs 만료 시간 (밀리초)
   * @returns 마킹 성공 여부 (이미 마킹되어 있으면 false)
   */
  async markSent(key: string, ttlMs: number = 86400000): Promise<boolean> {
    // 24시간 동안 중복 발송 방지
    const result = await this.client.set(key, '1', 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  /**
   * Redis 클라이언트 직접 접근 (필요한 경우)
   */
  getClient(): Redis {
    return this.client;
  }
}
