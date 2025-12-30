import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck, DiskHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { getNowKST } from '../common/utils/kst-date.util';
import { QueueService } from '../queues/queue.service';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Health Check 컨트롤러
 * 시스템 상태를 확인하는 엔드포인트 제공
 */
@ApiTags('시스템-상태확인')
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
    private queueService: QueueService,
    private httpService: HttpService,
    private configService: ConfigService,
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
        service: 'biocom-api',
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
      timestamp: getNowKST().toISOString(),
      service: 'biocom-api',
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
      timestamp: getNowKST().toISOString(),
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

  /**
   * 테스트 엔드포인트
   * CI/CD 배포 확인 및 간단한 동작 테스트용
   */
  @Get('test')
  @Public()
  @ApiOperation({
    summary: '테스트 엔드포인트',
    description: 'CI/CD 배포 확인 및 간단한 동작 테스트용 엔드포인트입니다.'
  })
  @ApiResponse({
    status: 200,
    description: '테스트 성공',
    schema: {
      example: {
        message: 'biocom-bo-api is running!',
        timestamp: '2024-01-01T00:00:00.000Z',
        environment: 'development'
      }
    }
  })
  test() {
    return {
      message: 'biocom-bo-api is running!',
      timestamp: getNowKST().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * MQ 연결 테스트
   * Redis/BullMQ 연결 상태 확인
   */
  @Get('mq')
  @Public()
  @ApiOperation({
    summary: 'MQ 연결 테스트',
    description: 'Redis/BullMQ 연결 상태를 확인합니다.'
  })
  @ApiResponse({
    status: 200,
    description: 'MQ 연결 테스트 결과',
    schema: {
      example: {
        success: true,
        jobId: '123',
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  async testMq() {
    const result = await this.queueService.testConnection();
    return {
      ...result,
      timestamp: getNowKST().toISOString(),
    };
  }

  /**
   * biocom-api 기본 헬스체크
   */
  @Get('biocom-api')
  @Public()
  @ApiOperation({
    summary: 'biocom-api 헬스체크',
    description: 'biocom-api 서버의 기본 상태를 확인합니다.'
  })
  @ApiResponse({
    status: 200,
    description: 'biocom-api 연결 성공',
    schema: {
      example: {
        success: true,
        data: { status: 'ok', service: 'biocom-api' },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  async testBiocomApi() {
    try {
      const apiUrl = this.configService.get<string>('BIOCOM_API_URL', 'http://localhost:10804');
      const response = await firstValueFrom(
        this.httpService.get(`${apiUrl}/api/health`)
      );
      return {
        success: true,
        data: response.data,
        timestamp: getNowKST().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: getNowKST().toISOString(),
      };
    }
  }

  /**
   * biocom-api → biocom-mq 연결 테스트
   */
  @Get('biocom-api/mq')
  @Public()
  @ApiOperation({
    summary: 'biocom-api → biocom-mq 연결 테스트',
    description: 'biocom-api를 통해 biocom-mq(Redis/BullMQ) 연결 상태를 확인합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '연결 테스트 결과',
    schema: {
      example: {
        success: true,
        data: { success: true, jobId: '123' },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  async testBiocomApiMq() {
    try {
      const apiUrl = this.configService.get<string>('BIOCOM_API_URL', 'http://localhost:10804');
      const response = await firstValueFrom(
        this.httpService.get(`${apiUrl}/api/queue-test/ping`)
      );
      return {
        success: true,
        data: response.data,
        timestamp: getNowKST().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: getNowKST().toISOString(),
      };
    }
  }
}