import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private driver: Driver;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const uri = this.configService.get<string>('NEO4J_URI');
    const username = this.configService.get<string>('NEO4J_USERNAME');
    const password = this.configService.get<string>('NEO4J_PASSWORD');

    if (!uri || !username || !password) {
      throw new Error('Neo4j connection configuration is missing');
    }

    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

    try {
      await this.driver.verifyConnectivity();
      this.logger.log('✅ Neo4j connection established successfully');
    } catch (error) {
      this.logger.error('❌ Neo4j connection failed', error.stack);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.driver) {
      await this.driver.close();
      this.logger.log('Neo4j connection closed');
    }
  }

  /**
   * Session을 생성합니다.
   * 반드시 try-finally로 session.close()를 호출해야 합니다!
   */
  getSession(): Session {
    return this.driver.session({
      database: this.configService.get<string>('NEO4J_DATABASE', 'neo4j'),
    });
  }

  /**
   * Read 전용 Session
   */
  getReadSession(): Session {
    return this.driver.session({
      database: this.configService.get<string>('NEO4J_DATABASE', 'neo4j'),
      defaultAccessMode: neo4j.session.READ,
    });
  }

  /**
   * Write 전용 Session
   */
  getWriteSession(): Session {
    return this.driver.session({
      database: this.configService.get<string>('NEO4J_DATABASE', 'neo4j'),
      defaultAccessMode: neo4j.session.WRITE,
    });
  }

  /**
   * Driver 직접 접근 (고급 사용)
   */
  getDriver(): Driver {
    return this.driver;
  }
}
