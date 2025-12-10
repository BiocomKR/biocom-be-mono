import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

/**
 * 미션 마스터 서비스
 * 재사용 가능한 미션들을 관리
 */
@Injectable()
export class MissionService {
  private readonly logger = new Logger(MissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 모든 미션 목록 조회
   */
  async getAllMissions() {
    this.logger.log('모든 미션 목록 조회');

    const missions = await this.prisma.mission.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(`미션 목록 조회 완료 - 총 ${missions.length}개`);
    return missions;
  }

  /**
   * 미션 ID로 조회
   */
  async getMissionById(id: number) {
    this.logger.log(`미션 상세 조회 - ID: ${id}`);

    const mission = await this.prisma.mission.findUnique({
      where: { id },
    });

    if (!mission) {
      throw new NotFoundException(`미션을 찾을 수 없습니다: ${id}`);
    }

    return mission;
  }

  /**
   * 미션 타입별 조회
   */
  async getMissionsByType(type: string) {
    this.logger.log(`미션 타입별 조회 - 타입: ${type}`);

    const missions = await this.prisma.mission.findMany({
      where: {
        type,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(`미션 타입별 조회 완료 - 타입: ${type}, 미션 수: ${missions.length}`);
    return missions;
  }

  /**
   * 홈 화면용 미션 목록 조회
   * - sortOrder 기준 오름차순 정렬
   * - 홈 화면 MissionItemDto 형식으로 반환
   */
  async getMissionsForHome() {
    this.logger.log('홈 화면용 미션 목록 조회');

    const missions = await this.prisma.mission.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        points: true,
        dailyLimit: true,
        recordType: true,
        sortOrder: true,
      },
    });

    return missions.map((m) => ({
      id: m.id,
      title: m.name,
      description: m.description || '',
      point: m.points,
      max: m.dailyLimit,
      current: 0,
      recordType: m.recordType,
      sortOrder: m.sortOrder,
    }));
  }
}