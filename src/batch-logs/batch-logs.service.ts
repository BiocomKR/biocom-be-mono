import { Injectable } from '@nestjs/common';
import { Logging, Entry } from '@google-cloud/logging';
import { ConfigService } from '@nestjs/config';

export interface BatchLogEntry {
  timestamp: string;
  severity: string;
  jobName: string;
  message: string;
  labels?: Record<string, string>;
}

export interface BatchJobInfo {
  name: string;
  displayName: string;
  schedule: string;
  description: string;
}

@Injectable()
export class BatchLogsService {
  private logging: Logging;

  // 배치 작업 목록 정의
  private readonly batchJobs: BatchJobInfo[] = [
    {
      name: 'challenge-activation',
      displayName: '챌린지 활성화',
      schedule: '매주 월요일 00:05',
      description: 'PENDING 상태의 챌린지를 ACTIVE로 변경',
    },
    {
      name: 'supplement-routine',
      displayName: '영양제 기록 생성',
      schedule: '매주 월요일 00:10',
      description: '새 주차 영양제 복용 기록 생성',
    },
    {
      name: 'auto-billing',
      displayName: '자동결제',
      schedule: '매일 00:00',
      description: '구독 자동결제 처리',
    },
    {
      name: 'subscription-expire',
      displayName: '구독 만료 처리',
      schedule: '매일 00:01',
      description: '만료된 구독 상태 변경',
    },
    {
      name: 'push-scheduler',
      displayName: '푸시 스케줄러',
      schedule: '매분',
      description: '예약된 푸시 알림 발송',
    },
    {
      name: 'shipping-sync',
      displayName: '배송 동기화',
      schedule: '주기적',
      description: '배송 상태 동기화',
    },
  ];

  constructor(private configService: ConfigService) {
    const projectId = this.configService.get<string>('GCP_PROJECT_ID', 'api-dev-biocom');
    this.logging = new Logging({ projectId });
  }

  getBatchJobs(): BatchJobInfo[] {
    return this.batchJobs;
  }

  async getJobLogs(
    jobName: string,
    options: {
      limit?: number;
      startTime?: Date;
      endTime?: Date;
      severity?: string;
    } = {},
  ): Promise<BatchLogEntry[]> {
    const { limit = 100, startTime, endTime, severity } = options;
    const namespace = this.configService.get<string>('GKE_NAMESPACE', 'biocom-api');

    const filters: string[] = [
      `resource.type="k8s_container"`,
      `resource.labels.namespace_name="${namespace}"`,
    ];

    if (jobName !== 'all') {
      filters.push(`resource.labels.container_name=~"${jobName}.*" OR labels.job_name=~"${jobName}.*"`);
    }

    if (startTime) {
      filters.push(`timestamp >= "${startTime.toISOString()}"`);
    }
    if (endTime) {
      filters.push(`timestamp <= "${endTime.toISOString()}"`);
    }

    if (severity && severity !== 'ALL') {
      filters.push(`severity >= "${severity}"`);
    }

    try {
      const [entries] = await this.logging.getEntries({
        filter: filters.join(' AND '),
        orderBy: 'timestamp desc',
        pageSize: limit,
      });

      return entries.map((entry: Entry) => this.parseLogEntry(entry, jobName));
    } catch (error) {
      console.error('Cloud Logging 조회 실패:', error);
      throw error;
    }
  }

  async getAllJobsLogs(limit: number = 200): Promise<BatchLogEntry[]> {
    return this.getJobLogs('all', { limit });
  }

  private parseLogEntry(entry: Entry, defaultJobName: string): BatchLogEntry {
    const metadata = entry.metadata as any;
    const labels = metadata?.labels || {};
    const resource = metadata?.resource?.labels || {};

    let jobName = defaultJobName;
    if (labels.job_name) {
      jobName = labels.job_name;
    } else if (resource.container_name) {
      jobName = resource.container_name;
    }

    let message = '';
    if (typeof entry.data === 'string') {
      message = entry.data;
    } else if (entry.data && typeof entry.data === 'object') {
      const data = entry.data as any;
      message = data.message || data.textPayload || JSON.stringify(data);
    }

    return {
      timestamp: metadata?.timestamp || new Date().toISOString(),
      severity: metadata?.severity || 'INFO',
      jobName,
      message,
      labels,
    };
  }

  async getJobStats(jobName: string): Promise<{
    totalRuns: number;
    successCount: number;
    errorCount: number;
    lastRun?: string;
  }> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    const logs = await this.getJobLogs(jobName, {
      startTime,
      endTime,
      limit: 1000,
    });

    const errorLogs = logs.filter(log => log.severity === 'ERROR');
    const infoLogs = logs.filter(log => log.severity === 'INFO');

    return {
      totalRuns: logs.length,
      successCount: infoLogs.length,
      errorCount: errorLogs.length,
      lastRun: logs[0]?.timestamp,
    };
  }
}
