import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../../common/services/prisma.service';
import { LoggerService } from '../../common/services/logger.service';

/**
 * Prisma 데이터베이스 Health Indicator
 * PostgreSQL 데이터베이스 연결 상태를 확인
 */
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  /**
   * 데이터베이스 연결 상태 확인
   * 
   * @param key 헬스체크 키 (예: 'database')
   * @returns 헬스체크 결과
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    
    try {
      // 간단한 쿼리로 데이터베이스 연결 확인
      await this.prisma.$queryRaw`SELECT 1`;
      
      const responseTime = Date.now() - startTime;
      
      // 응답 시간이 5초 이상이면 경고
      if (responseTime > 5000) {
        this.logger.warn(
          `Database response time is slow: ${responseTime}ms`,
          'PrismaHealthIndicator'
        );
      }
      
      return this.getStatus(key, true, {
        status: 'up',
        responseTime: `${responseTime}ms`,
        type: 'PostgreSQL',
      });
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error.stack,
        'PrismaHealthIndicator'
      );
      
      throw new HealthCheckError(
        'Database connection failed',
        this.getStatus(key, false, {
          status: 'down',
          error: error.message,
          type: 'PostgreSQL',
        }),
      );
    }
  }

  /**
   * 데이터베이스 상세 정보 조회
   * 
   * @param key 헬스체크 키
   * @returns 상세 정보 포함된 헬스체크 결과
   */
  async getDetailedStatus(key: string): Promise<HealthIndicatorResult> {
    try {
      // 데이터베이스 버전 조회
      const versionResult = await this.prisma.$queryRaw<any[]>`SELECT version()`;
      const version = versionResult[0]?.version || 'unknown';

      // 활성 연결 수 조회
      const connectionsResult = await this.prisma.$queryRaw<any[]>`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;
      const activeConnections = connectionsResult[0]?.active_connections || 0;

      // 데이터베이스 크기 조회
      const sizeResult = await this.prisma.$queryRaw<any[]>`
        SELECT pg_database_size(current_database()) as size
      `;
      const dbSize = sizeResult[0]?.size || 0;
      const dbSizeMB = Math.round(dbSize / (1024 * 1024));

      return this.getStatus(key, true, {
        status: 'up',
        version: version.split(' ')[0],
        activeConnections: parseInt(activeConnections),
        databaseSize: `${dbSizeMB}MB`,
        type: 'PostgreSQL',
      });
    } catch (error) {
      this.logger.error(
        'Database detailed health check failed',
        error.stack,
        'PrismaHealthIndicator'
      );
      
      throw new HealthCheckError(
        'Database detailed check failed',
        this.getStatus(key, false, {
          status: 'down',
          error: error.message,
        }),
      );
    }
  }
}