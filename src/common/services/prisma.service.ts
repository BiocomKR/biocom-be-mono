import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['warn', 'error'],
    });
  }

  async onModuleInit() {
    try {
      this.logger.log('데이터베이스 연결 시작...');
      await this.$connect();
      this.logger.log('데이터베이스 연결 완료');
    } catch (error) {
      this.logger.error('데이터베이스 연결 실패:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log('데이터베이스 연결 종료...');
      await this.$disconnect();
      this.logger.log('데이터베이스 연결 종료 완료');
    } catch (error) {
      this.logger.error('데이터베이스 연결 종료 실패:', error);
      throw error;
    }
  }
}
