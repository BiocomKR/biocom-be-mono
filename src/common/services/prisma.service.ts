import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 서비스 클래스
 * 데이터베이스 연결 및 트랜잭션 관리를 담당하는 핵심 서비스
 * 
 * 주요 기능:
 * - PostgreSQL 데이터베이스 연결 관리
 * - 애플리케이션 시작/종료 시 자동 연결/해제
 * - 구조화된 로깅을 통한 데이터베이스 작업 추적
 * - 트랜잭션 지원
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  /**
   * 모듈 초기화 시 데이터베이스 연결
   * 애플리케이션 시작 시 자동으로 호출
   */
  async onModuleInit() {
    try {
      this.logger.log('데이터베이스 연결을 시작합니다...');
      await this.$connect();
      this.logger.log('데이터베이스 연결이 성공적으로 완료되었습니다.');
    } catch (error) {
      this.logger.error('데이터베이스 연결에 실패했습니다:', error);
      throw error;
    }
  }

  /**
   * 모듈 종료 시 데이터베이스 연결 해제
   * 애플리케이션 종료 시 자동으로 호출
   */
  async onModuleDestroy() {
    try {
      this.logger.log('데이터베이스 연결을 종료합니다...');
      await this.$disconnect();
      this.logger.log('데이터베이스 연결이 성공적으로 종료되었습니다.');
    } catch (error) {
      this.logger.error('데이터베이스 연결 종료 중 오류가 발생했습니다:', error);
      throw error;
    }
  }

  /**
   * 헬스체크를 위한 데이터베이스 연결 상태 확인
   * @returns Promise<boolean> 연결 상태 (true: 연결됨, false: 연결 안됨)
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.debug('데이터베이스 헬스체크 성공');
      return true;
    } catch (error) {
      this.logger.error('데이터베이스 헬스체크 실패:', error);
      return false;
    }
  }
}