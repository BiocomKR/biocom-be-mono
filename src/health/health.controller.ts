import { Controller, Get } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';

@Controller('health')
export class HealthController {
  constructor(private readonly neo4jService: Neo4jService) {}

  @Get()
  async check() {
    try {
      // Neo4j 연결 확인
      const session = this.neo4jService.getReadSession();
      try {
        await session.run('RETURN 1');
      } finally {
        await session.close();
      }

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          neo4j: 'up',
        },
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        services: {
          neo4j: 'down',
        },
        error: error.message,
      };
    }
  }
}
