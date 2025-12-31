import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck, DiskHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { QueueService } from '../queues/queue.service';

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
    private prisma: PrismaService,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
    private httpService: HttpService,
    private configService: ConfigService,
    private queueService: QueueService,
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
      throw new ServiceUnavailableException({
        success: false,
        error: error.message,
        timestamp: getNowKST().toISOString(),
      });
    }
  }

  /**
   * biocom-api → biocom-mq 연결 테스트
   * 1. biocom-api의 /queue-test/health-check 호출 (큐에 잡 추가)
   * 2. 1초 대기 (MQ 워커가 잡 처리 후 DB 기록)
   * 3. app_configs에서 MQ_HEALTH_CHECK 조회하여 updatedAt 확인
   */
  @Get('biocom-mq')
  @Public()
  @ApiOperation({
    summary: 'biocom-api → biocom-mq 연결 테스트',
    description: 'biocom-api를 통해 health-check 큐에 잡을 넣고, MQ 워커가 처리 후 DB에 기록한 결과를 확인합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '연결 테스트 결과',
    schema: {
      example: {
        success: true,
        apiResponse: { success: true, jobId: '123' },
        dbCheck: {
          key: 'MQ_HEALTH_CHECK',
          value: 'biocom-mq',
          updatedAt: '2024-01-01T00:00:00.000Z',
          isRecent: true
        },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  async testBiocomMq() {
    const requestTime = getNowKST();
    let apiResponse: any = null;

    // 1. biocom-api를 통해 health-check 큐에 잡 추가
    try {
      const apiUrl = this.configService.get<string>('BIOCOM_API_URL', 'http://localhost:10804');
      const response = await firstValueFrom(
        this.httpService.get(`${apiUrl}/api/queue-test/health-check`)
      );
      apiResponse = response.data;
    } catch (error) {
      throw new ServiceUnavailableException({
        success: false,
        error: `biocom-api 연결 실패: ${error.message}`,
        timestamp: requestTime.toISOString(),
      });
    }

    // 2. 1초 대기 (MQ 워커가 잡 처리할 시간)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. app_configs에서 MQ_HEALTH_CHECK 조회
    const config = await this.prisma.appConfig.findUnique({
      where: { configKey: 'MQ_HEALTH_CHECK' },
    });

    if (!config) {
      throw new ServiceUnavailableException({
        success: false,
        apiResponse,
        error: 'MQ_HEALTH_CHECK 설정값이 DB에 없습니다',
        timestamp: requestTime.toISOString(),
      });
    }

    // 4. updatedAt이 요청 시간 이후인지 확인 (5초 이내)
    const updatedAt = new Date(config.updatedAt);
    const diffMs = updatedAt.getTime() - requestTime.getTime();
    const isRecent = diffMs >= -1000 && diffMs <= 5000;

    if (!isRecent) {
      throw new ServiceUnavailableException({
        success: false,
        apiResponse,
        dbCheck: {
          key: config.configKey,
          value: config.configValue,
          updatedAt: config.updatedAt,
          isRecent: false,
        },
        error: 'MQ가 DB에 값을 기록하지 못했습니다',
        timestamp: requestTime.toISOString(),
      });
    }

    return {
      success: true,
      apiResponse,
      dbCheck: {
        key: config.configKey,
        value: config.configValue,
        updatedAt: config.updatedAt,
        isRecent: true,
      },
      timestamp: requestTime.toISOString(),
    };
  }

  /**
   * bo-api → Redis 큐 → biocom-mq 직접 테스트
   * bo-api에서 직접 Redis 큐에 잡을 넣고, MQ 워커가 처리 후 DB에 기록한 결과를 확인
   */
  @Get('bo-mq')
  @Public()
  @ApiOperation({
    summary: 'bo-api → Redis 큐 → biocom-mq 직접 테스트',
    description: 'bo-api에서 직접 health-check 큐에 잡을 넣고, MQ 워커가 처리 후 DB에 기록한 결과를 확인합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '연결 테스트 결과',
    schema: {
      example: {
        success: true,
        jobId: '123',
        dbCheck: {
          key: 'MQ_HEALTH_CHECK',
          value: 'biocom-mq',
          updatedAt: '2024-01-01T00:00:00.000Z',
          isRecent: true
        },
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  async testBoMq() {
    const requestTime = getNowKST();
    let jobId: string | undefined;

    // 1. bo-api에서 직접 health-check 큐에 잡 추가
    try {
      const job = await this.queueService.addHealthCheck();
      jobId = job.id;
    } catch (error) {
      throw new ServiceUnavailableException({
        success: false,
        error: `큐 추가 실패: ${error.message}`,
        timestamp: requestTime.toISOString(),
      });
    }

    // 2. 1초 대기 (MQ 워커가 잡 처리할 시간)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. app_configs에서 MQ_HEALTH_CHECK 조회
    const config = await this.prisma.appConfig.findUnique({
      where: { configKey: 'MQ_HEALTH_CHECK' },
    });

    if (!config) {
      throw new ServiceUnavailableException({
        success: false,
        jobId,
        error: 'MQ_HEALTH_CHECK 설정값이 DB에 없습니다',
        timestamp: requestTime.toISOString(),
      });
    }

    // 4. updatedAt이 요청 시간 이후인지 확인 (5초 이내)
    const updatedAt = new Date(config.updatedAt);
    const diffMs = updatedAt.getTime() - requestTime.getTime();
    const isRecent = diffMs >= -1000 && diffMs <= 5000;

    if (!isRecent) {
      throw new ServiceUnavailableException({
        success: false,
        jobId,
        dbCheck: {
          key: config.configKey,
          value: config.configValue,
          updatedAt: config.updatedAt,
          isRecent: false,
        },
        error: 'MQ가 DB에 값을 기록하지 못했습니다',
        timestamp: requestTime.toISOString(),
      });
    }

    return {
      success: true,
      jobId,
      dbCheck: {
        key: config.configKey,
        value: config.configValue,
        updatedAt: config.updatedAt,
        isRecent: true,
      },
      timestamp: requestTime.toISOString(),
    };
  }
}
