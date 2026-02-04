import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';
import { format, addDays } from 'date-fns';
import axios from 'axios';
import * as https from 'https';

/**
 * 알러지 동기화 Job 데이터 인터페이스
 */
export interface AllergySyncJobData {
  type: 'master' | 'page';
  syncType?: 'full' | 'incremental';
  pageNo?: number;
  date?: string;
}

interface SibIgGListItem {
  userId: string; // 실제로는 chartId
  userName: string;
  date: string;
  userGender: string;
  userBirth: string;
}

interface SibIgGLevelItem {
  chartId: string;
  userName: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
}

/**
 * 알러지 데이터 동기화 프로세서 (MQ Worker)
 *
 * 마스터-워커 패턴:
 * - master job: 워커 job들을 생성 (페이지별 또는 날짜별)
 * - page job: 실제 동기화 처리
 *
 * 증분 동기화:
 * - app_config.ALLERGY_SYNC_LAST_DATE에 마지막 동기화 날짜 저장
 * - 이후 실행 시 해당 날짜 이후 데이터만 동기화
 *
 * NOTE: 운영 환경(NODE_ENV=production)에서만 실행됨
 */
@Processor('allergy-sync')
export class AllergySyncProcessor extends WorkerHost {
  private readonly logger = new Logger(AllergySyncProcessor.name);
  private readonly sibBaseUrl = 'https://sib.codns.com:3001';
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('allergy-sync') private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job<AllergySyncJobData>): Promise<any> {
    // 운영 환경에서만 실행
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `알러지 동기화: 운영 환경에서만 실행됩니다. (현재: ${process.env.NODE_ENV})`,
      );
      return { skipped: true, reason: 'not production' };
    }

    const { type, syncType, pageNo, date } = job.data;

    this.logger.log(
      `🧬 [AllergySyncProcessor] Job 시작: id=${job.id}, type=${type}, syncType=${syncType}, pageNo=${pageNo}, date=${date}`,
    );

    try {
      if (type === 'master') {
        // 마스터 job: 워커 job들 생성
        await this.createWorkerJobs(syncType || 'incremental');
        return { success: true, type: 'master' };
      } else {
        // 워커 job: 실제 동기화 처리
        const result = await this.syncPage(pageNo, date);
        return { success: true, type: 'page', ...result };
      }
    } catch (error) {
      this.logger.error(
        `❌ [AllergySyncProcessor] Job 실패: id=${job.id}, error=${error.message}`,
        error.stack,
      );
      await this.sendSlackAlert('동기화 실패', error);
      throw error;
    }
  }

  /**
   * 마스터: 워커 job 생성
   */
  private async createWorkerJobs(syncType: 'full' | 'incremental') {
    this.logger.log(`마스터 Job 시작: syncType=${syncType}`);

    if (syncType === 'full') {
      // 전체 동기화: 페이지별 job 생성
      const firstPage = await this.fetchSibApi('/api/IgGReport/list?pageNo=1&pageRow=100');
      const totalPage = firstPage.totalPage?.totalPage || firstPage.totalPage || 1;

      this.logger.log(`전체 동기화: 총 ${totalPage} 페이지 job 생성`);

      for (let page = 1; page <= totalPage; page++) {
        await this.queue.add(
          'sync',
          { type: 'page', pageNo: page } as AllergySyncJobData,
          { removeOnComplete: 10, removeOnFail: 100 },
        );
      }

      this.logger.log(`마스터 Job 완료: ${totalPage}개 워커 job 생성됨`);
    } else {
      // 증분 동기화: 마지막 동기화 날짜 이후만
      const lastSyncConfig = await this.prisma.appConfig.findUnique({
        where: { configKey: 'ALLERGY_SYNC_LAST_DATE' },
      });

      const lastSyncDate = lastSyncConfig?.configValue;
      const today = format(getNowKST(), 'yyyy-MM-dd');

      if (!lastSyncDate) {
        // 최초 실행: 전체 동기화로 전환
        this.logger.log('최초 실행 감지: 전체 동기화로 전환');
        await this.createWorkerJobs('full');

        // 마지막 동기화 날짜 저장
        await this.prisma.appConfig.create({
          data: {
            configKey: 'ALLERGY_SYNC_LAST_DATE',
            configValue: today,
            valueType: 'STRING',
            description: 'IgG 알러지 데이터 마지막 동기화 날짜',
            createdAt: getNowKST(),
          },
        });
        return;
      }

      // 날짜별 job 생성 (lastSyncDate 당일부터 - 전날 배치 이후 추가된 데이터 포함)
      let currentDate = new Date(lastSyncDate);
      const todayDate = new Date(today);
      let jobCount = 0;

      while (currentDate <= todayDate) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        await this.queue.add(
          'sync',
          { type: 'page', date: dateStr } as AllergySyncJobData,
          { removeOnComplete: 10, removeOnFail: 100 },
        );
        currentDate = addDays(currentDate, 1);
        jobCount++;
      }

      // 마지막 동기화 날짜를 어제로 업데이트 (오늘 배치 이후 추가분은 내일 다시 조회)
      const yesterday = format(addDays(new Date(today), -1), 'yyyy-MM-dd');
      await this.prisma.appConfig.update({
        where: { configKey: 'ALLERGY_SYNC_LAST_DATE' },
        data: {
          configValue: yesterday,
          updatedAt: getNowKST(),
        },
      });

      this.logger.log(`증분 동기화: ${jobCount}개 날짜별 job 생성됨 (${lastSyncDate} ~ ${today})`);
    }
  }

  /**
   * 워커: 페이지 또는 날짜별 동기화
   * - pageNo만 있으면: 해당 페이지만 처리 (전체 동기화용)
   * - date만 있으면: 해당 날짜의 모든 페이지 처리 (증분 동기화용)
   */
  private async syncPage(
    pageNo?: number,
    date?: string,
  ): Promise<{ synced: number; skipped: number }> {
    this.logger.log(`워커 Job 시작: pageNo=${pageNo}, date=${date}`);

    let synced = 0;
    let skipped = 0;

    if (date) {
      // 날짜별 동기화: 해당 날짜의 모든 페이지 처리
      let currentPage = 1;
      let totalPage = 1;

      do {
        const endpoint = `/api/IgGReport/list?pageRow=100&pageNo=${currentPage}&date=${date}`;
        const listRes = await this.fetchSibApi(endpoint);
        const items: SibIgGListItem[] = listRes.results || [];
        totalPage = listRes.totalPage?.totalPage || listRes.totalPage || 1;

        this.logger.log(`날짜 ${date} 페이지 ${currentPage}/${totalPage} 처리 중 (${items.length}건)`);

        for (const item of items) {
          const chartId = item.userId;
          try {
            const result = await this.syncChartData(chartId);
            if (result === 'synced') {
              synced++;
            } else {
              skipped++;
            }
            await this.delay(100);
          } catch (error) {
            this.logger.error(`chartId ${chartId} 동기화 실패: ${error.message}`);
            skipped++;
          }
        }

        currentPage++;
      } while (currentPage <= totalPage);
    } else {
      // 페이지별 동기화: 단일 페이지만 처리
      const endpoint = `/api/IgGReport/list?pageRow=100&pageNo=${pageNo || 1}`;
      const listRes = await this.fetchSibApi(endpoint);
      const items: SibIgGListItem[] = listRes.results || [];

      for (const item of items) {
        const chartId = item.userId;
        try {
          const result = await this.syncChartData(chartId);
          if (result === 'synced') {
            synced++;
          } else {
            skipped++;
          }
          await this.delay(100);
        } catch (error) {
          this.logger.error(`chartId ${chartId} 동기화 실패: ${error.message}`);
          skipped++;
        }
      }
    }

    this.logger.log(
      `워커 Job 완료: pageNo=${pageNo}, date=${date}, synced=${synced}, skipped=${skipped}`,
    );

    return { synced, skipped };
  }

  /**
   * 개별 chartId 동기화 (create only - 기존 데이터 보존)
   */
  private async syncChartData(chartId: string): Promise<'synced' | 'skipped'> {
    // 이미 존재하면 스킵
    const existing = await this.prisma.userAllergyReport.findUnique({
      where: { chartId },
    });

    if (existing) {
      return 'skipped';
    }

    // SIB API에서 레벨 데이터 조회
    const levelRes = await this.fetchSibApi(`/api/report/getIggLevels?chartId=${chartId}`);

    if (!levelRes || levelRes.length === 0) {
      this.logger.warn(`chartId ${chartId}: 레벨 데이터 없음`);
      return 'skipped';
    }

    const data: SibIgGLevelItem = levelRes[0];

    // DB에 저장
    await this.prisma.userAllergyReport.create({
      data: {
        chartId,
        level1: data.level1 || null,
        level2: data.level2 || null,
        level3: data.level3 || null,
        level4: data.level4 || null,
        level5: data.level5 || null,
        userId: null, // 나중에 유저 조회 시 매핑
        createdAt: getNowKST(),
        updatedAt: getNowKST(),
      },
    });

    return 'synced';
  }

  /**
   * SIB API 호출
   */
  private async fetchSibApi(endpoint: string): Promise<any> {
    const url = `${this.sibBaseUrl}${endpoint}`;

    try {
      const response = await axios.get(url, {
        httpsAgent: this.httpsAgent,
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`SIB API 호출 실패: ${endpoint}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 딜레이 헬퍼
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 슬랙 알림 전송
   */
  private async sendSlackAlert(message: string, error?: Error): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      await axios.post(
        webhookUrl,
        {
          text: `🚨 [알러지 동기화 실패]\n${message}\n${error?.message || ''}`,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
        },
      );
    } catch (slackError) {
      this.logger.error(`슬랙 알림 전송 실패: ${slackError.message}`);
    }
  }
}
