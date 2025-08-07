import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { EventService } from '../event/event.service';
import { MissionCompletionService } from './mission-completion.service';
import { Mission, MissionSchedule } from '@prisma/client';
import { PaginationHelper, PaginatedResult } from '../common/utils/pagination.util';

/**
 * 미션 서비스
 * 미션 마스터 데이터 및 일정 관리
 */
@Injectable()
export class MissionService {
  private readonly logger = new Logger(MissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    public readonly eventService: EventService,
    private readonly missionCompletionService: MissionCompletionService,
  ) {}

  /**
   * 모든 활성 미션 조회
   */
  async getAllMissions(): Promise<Mission[]> {
    return await this.prisma.mission.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * 특정 미션 조회 (코드로)
   */
  async getMissionByCode(code: string): Promise<Mission> {
    const mission = await this.prisma.mission.findUnique({
      where: { code },
    });

    if (!mission) {
      throw new NotFoundException(`미션을 찾을 수 없습니다: ${code}`);
    }

    return mission;
  }

  /**
   * 특정 미션 조회 (ID로)
   */
  async getMissionById(id: number): Promise<Mission> {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        schedules: true,
        eventMissions: true,
      }
    });

    if (!mission) {
      throw new NotFoundException(`미션을 찾을 수 없습니다: ${id}`);
    }

    return mission;
  }

  /**
   * 특정 일차의 미션 목록 조회
   */
  async getDayMissions(userId: number, day: number): Promise<{
    available: Array<{
      mission: Mission;
      eventMission: any;
      completed: boolean;
      completionData?: any;
    }>;
    totalPoints: number;
    completedCount: number;
  }> {
    this.logger.log(`${day}일차 미션 조회 - 사용자: ${userId}`);

    // 활성 이벤트 확인
    const activeEvent = await this.eventService.getActiveEvent();
    
    // 해당 일차에 사용 가능한 이벤트-미션 조회
    const eventMissions = await this.prisma.eventMission.findMany({
      where: {
        eventId: activeEvent.id,
        isActive: true,
        OR: [
          {
            activeFromDay: { lte: day },
            activeToDay: { gte: day },
          },
          {
            activeFromDay: null,
            activeToDay: null,
          },
        ],
      },
      include: {
        mission: true,
      },
    });

    // 사용자의 완료 현황 조회
    const completions = await this.missionCompletionService.getDayCompletions(userId, day);
    const completionMap = new Map(
      completions.map(c => [c.eventMission.mission.id, c])
    );

    // 미션별 상태 정리
    const available = eventMissions.map(em => ({
      mission: em.mission,
      eventMission: em,
      completed: completionMap.has(em.missionId),
      completionData: completionMap.get(em.missionId),
    }));

    const totalPoints = available.reduce((sum, item) => 
      sum + (item.completed ? item.eventMission.points : 0), 0
    );
    const completedCount = available.filter(item => item.completed).length;

    return {
      available,
      totalPoints,
      completedCount,
    };
  }

  /**
   * 특정 일차의 미션 일정 조회
   */
  async getDaySchedule(day: number): Promise<MissionSchedule[]> {
    return await this.prisma.missionSchedule.findMany({
      where: { day },
      include: {
        mission: true,
      },
      orderBy: {
        mission: {
          sortOrder: 'asc',
        },
      },
    });
  }

  /**
   * 미션 완료 처리
   */
  async completeMission(
    userId: number,
    missionCode: string,
    day: number,
    fileUploadId?: number
  ): Promise<any> {
    this.logger.log(`미션 완료 요청 - 사용자: ${userId}, 미션: ${missionCode}, 일차: ${day}`);
    
    return await this.missionCompletionService.completeMission(
      userId,
      missionCode,
      day,
      fileUploadId
    );
  }

  /**
   * 사용자의 전체 미션 진행 현황
   */
  async getUserProgress(userId: number): Promise<{
    totalDays: number;
    completedDays: number;
    totalPoints: number;
    dailyProgress: Array<{
      day: number;
      completed: number;
      total: number;
      points: number;
    }>;
  }> {
    const activeEvent = await this.eventService.getActiveEvent();
    const { completions, totalPoints, completedDays } = 
      await this.missionCompletionService.getUserCompletions(userId);

    // 일차별 진행 상황 집계
    const dailyMap = new Map<number, { completed: number; points: number }>();
    
    for (const completion of completions) {
      const day = completion.day;
      if (!dailyMap.has(day)) {
        dailyMap.set(day, { completed: 0, points: 0 });
      }
      const daily = dailyMap.get(day)!;
      daily.completed++;
      daily.points += completion.pointsEarned;
    }

    // 각 일차별 전체 미션 수 계산
    const dailyProgress: Array<{ day: number; completed: number; total: number; points: number }> = [];
    
    for (let day = 1; day <= activeEvent.totalDays; day++) {
      const dayMissions = await this.getDayMissions(userId, day);
      const daily = dailyMap.get(day) || { completed: 0, points: 0 };
      
      dailyProgress.push({
        day,
        completed: daily.completed,
        total: dayMissions.available.length,
        points: daily.points,
      });
    }

    return {
      totalDays: activeEvent.totalDays,
      completedDays,
      totalPoints,
      dailyProgress,
    };
  }

  /**
   * 미션 마스터 데이터 관리 (관리자용)
   */
  async createMission(data: {
    code: string;
    name: string;
    description?: string;
    type?: string;
    points?: number;
    requireUpload?: boolean;
    category?: string;
    dailyLimit?: number;
    uploadType?: string;
    sortOrder?: number;
    isActive?: boolean;
    specificDay?: number | null;
  }): Promise<Mission> {
    this.logger.log(`미션 생성 - 이름: ${data.name}, 코드: ${data.code}`);

    // 중복 코드 확인
    const existing = await this.prisma.mission.findUnique({
      where: { code: data.code }
    });

    if (existing) {
      throw new BadRequestException(`이미 존재하는 미션 코드입니다: ${data.code}`);
    }

    const mission = await this.prisma.mission.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        type: data.type || 'DAILY',
        points: data.points || 100,
        requireUpload: data.requireUpload || false,
        category: data.category || 'DAILY',
        dailyLimit: data.dailyLimit || 1,
        uploadType: data.uploadType,
        sortOrder: data.sortOrder || 999,
        isActive: data.isActive ?? true,
        specificDay: data.specificDay !== undefined ? data.specificDay : null,
      },
    });

    this.logger.log(`미션 생성 완료 - ID: ${mission.id}`);
    return mission;
  }

  async updateMission(id: number, data: Partial<{
    name: string;
    description: string;
    type: string;
    points: number;
    isActive: boolean;
    sortOrder: number;
    specificDay: number | null;
  }>): Promise<Mission> {
    this.logger.log(`미션 수정 - ID: ${id}`);

    const mission = await this.prisma.mission.update({
      where: { id },
      data,
    });

    this.logger.log(`미션 수정 완료 - ID: ${id}`);
    return mission;
  }

  async deleteMission(id: number): Promise<void> {
    this.logger.log(`미션 삭제 - ID: ${id}`);

    // 관련 데이터 확인
    const relatedCount = await this.prisma.eventMission.count({
      where: { missionId: id },
    });

    if (relatedCount > 0) {
      throw new BadRequestException(`이미 이벤트에서 사용 중인 미션은 삭제할 수 없습니다. (연결된 이벤트 수: ${relatedCount})`);
    }

    // 미션 완료 기록 확인
    const completions = await this.prisma.missionCompletion.count({
      where: {
        eventMission: {
          missionId: id
        }
      }
    });

    if (completions > 0) {
      throw new BadRequestException(`완료 기록이 있는 미션은 삭제할 수 없습니다. (완료 기록 수: ${completions})`);
    }

    // 미션 스케줄 삭제
    await this.prisma.missionSchedule.deleteMany({
      where: { missionId: id }
    });

    // 미션 삭제
    await this.prisma.mission.delete({
      where: { id },
    });

    this.logger.log(`미션 삭제 완료 - ID: ${id}`);
  }

  /**
   * 미션 스케줄 조회
   */
  async getMissionSchedules(missionId: number): Promise<MissionSchedule[]> {
    this.logger.log(`미션 스케줄 조회 - 미션 ID: ${missionId}`);

    const schedules = await this.prisma.missionSchedule.findMany({
      where: { missionId },
      orderBy: { day: 'asc' }
    });

    this.logger.log(`미션 스케줄 조회 완료 - 미션 ID: ${missionId}, 스케줄 수: ${schedules.length}`);
    return schedules;
  }

  /**
   * 페이징 처리된 미션 목록 조회
   * 
   * @param page 페이지 번호
   * @param limit 페이지당 항목 수
   * @param filters 필터 조건
   * @param sort 정렬 조건
   * @returns 페이징 처리된 미션 목록
   */
  async getMissionsWithPagination(
    page: number,
    limit: number,
    filters: {
      search?: string;
      category?: string;
      isActive?: boolean;
      requireUpload?: boolean;
    },
    sort: {
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ): Promise<PaginatedResult<Mission>> {
    this.logger.log(`페이징 처리된 미션 목록 조회 - page: ${page}, limit: ${limit}`);

    // WHERE 조건 구성
    const where: any = {};

    // 검색어 필터
    if (filters.search) {
      const searchCondition = PaginationHelper.createSearchCondition(filters.search, ['name', 'description', 'code']);
      if (searchCondition) {
        Object.assign(where, searchCondition);
      }
    }

    // 기타 필터
    const additionalFilters = PaginationHelper.buildWhereClause({
      category: filters.category,
      isActive: filters.isActive,
      requireUpload: filters.requireUpload,
    });
    
    Object.assign(where, additionalFilters);

    // 페이징 처리
    const result = await PaginationHelper.paginate<Mission>(
      this.prisma.mission,
      { page, limit },
      {
        where,
        include: {
          _count: {
            select: {
              eventMissions: true,
              schedules: true,
            },
          },
        },
      },
      sort
    );

    this.logger.log(`페이징 처리된 미션 목록 조회 완료 - 총 ${result.total}개, ${result.totalPages} 페이지`);

    return result;
  }
}