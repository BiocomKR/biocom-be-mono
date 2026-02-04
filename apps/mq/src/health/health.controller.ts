import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /**
   * 단순 헬스체크 엔드포인트
   * MQ 워커가 살아있는지 확인용 (DB 쓰기는 health-check 큐에서 처리)
   */
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'biocom-mq',
    };
  }
}
