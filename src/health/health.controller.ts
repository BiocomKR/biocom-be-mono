import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck, DiskHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './indicators/prisma.health';

/**
 * Health Check 컨트롤러
 * 시스템 상태를 확인하는 엔드포인트 제공
 */
@ApiTags('health')
@Controller('health')
@SkipThrottle() // Health check는 Rate Limiting 제외
export class HealthController {
  /**
   * 애플리케이션 시작 시간 (가동 시간 계산용)
   */
  private readonly startTime = Date.now();

  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  /**
   * 기본 헬스체크
   * 간단한 상태 확인
   */
  @Get()
  @Public()
  @ApiOperation({ 
    summary: '기본 헬스체크', 
    description: '서버가 응답 가능한 상태인지 확인합니다.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '서버가 정상 작동 중',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00.000Z',
        service: 'nestjs-backend-template',
        version: '1.0.0',
        uptime: '00:05:30'
      }
    }
  })
  check() {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'nestjs-backend-template',
      version: '1.0.0',
      uptime,
    };
  }

  /**
   * 상세 헬스체크
   * 모든 시스템 구성 요소의 상태 확인
   */
  @Get('detailed')
  @Public()
  @HealthCheck()
  @ApiOperation({ 
    summary: '상세 헬스체크', 
    description: '데이터베이스, 디스크, 메모리 등 상세한 시스템 상태를 확인합니다.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '시스템 상태 정상',
    schema: {
      example: {
        status: 'ok',
        info: {
          database: { status: 'up' },
          disk: { status: 'up', used: '50%' },
          memory: { status: 'up', rss: '256MB' }
        },
        error: {},
        details: {}
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: '시스템 구성 요소 중 일부가 비정상' 
  })
  async checkDetailed() {
    return this.health.check([
      // 데이터베이스 연결 상태
      () => this.prismaHealth.isHealthy('database'),
      
      // 디스크 사용량 체크 (80% 이상 사용 시 경고)
      () => this.disk.checkStorage('disk', { 
        path: '/',
        thresholdPercent: 0.8,
      }),
      
      // 메모리 사용량 체크 (RSS 1GB 이상 사용 시 경고)
      () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),
    ]);
  }

  /**
   * 라이브니스 프로브
   * 쿠버네티스 라이브니스 체크용
   */
  @Get('liveness')
  @Public()
  @ApiOperation({ 
    summary: '라이브니스 프로브', 
    description: '애플리케이션이 살아있는지 확인합니다. (K8s liveness probe용)' 
  })
  @ApiResponse({ status: 200, description: '애플리케이션 정상' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 레디니스 프로브
   * 쿠버네티스 레디니스 체크용
   */
  @Get('readiness')
  @Public()
  @HealthCheck()
  @ApiOperation({ 
    summary: '레디니스 프로브', 
    description: '애플리케이션이 트래픽을 받을 준비가 되었는지 확인합니다. (K8s readiness probe용)' 
  })
  @ApiResponse({ status: 200, description: '트래픽 수신 준비 완료' })
  @ApiResponse({ status: 503, description: '트래픽 수신 준비 안됨' })
  async readiness() {
    // 데이터베이스만 체크 (필수 구성 요소)
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
    ]);
  }
}