import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * 관리자 미션 관리 서비스
 * 백오피스에서 미션을 생성, 수정, 삭제하는 기능
 */
@Injectable()
export class ManagementMissionService {
  private readonly logger = new Logger(ManagementMissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 모든 미션 목록 조회 (관리자용)
   * @param options 조회 옵션
   */
  async findAllMissions(options: {
    page?: number;
    limit?: number;
    type?: string;
    category?: string;
    search?: string;
  }) {
    const { page = 1, limit = 10, type, category, search } = options;
    const skip = (page - 1) * limit;

    // 검색 조건 구성
    const where: Prisma.MissionWhereInput = {};
    
    if (type) {
      where.type = type;
    }
    
    if (category) {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [missions, total] = await Promise.all([
      this.prisma.mission.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' }
        ],
        include: {
          challengeMissions: {
            select: {
              id: true,
              challengeId: true,
              day: true,
              points: true,
              challenge: {
                select: {
                  name: true
                }
              }
            }
          },
          _count: {
            select: {
              challengeMissions: true
            }
          }
        }
      }),
      this.prisma.mission.count({ where })
    ]);

    return {
      missions,
      pagination: {
        current: page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 미션 상세 조회
   * @param id 미션 ID
   */
  async findMissionById(id: number) {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        challengeMissions: {
          include: {
            challenge: {
              select: {
                id: true,
                name: true,
                isActive: true
              }
            }
          }
        },
        schedules: true,
        _count: {
          select: {
            challengeMissions: true
          }
        }
      }
    });

    if (!mission) {
      throw new NotFoundException('미션을 찾을 수 없습니다');
    }

    return mission;
  }

  /**
   * 새로운 미션 생성
   * @param data 미션 데이터
   */
  async createMission(data: {
    code: string;
    name: string;
    description?: string;
    points: number;
    requireUpload?: boolean;
    sortOrder?: number;
    category?: string;
    type?: string;
    recordType?: string;
    dailyLimit?: number;
    specificDay?: number;
    totalDays?: number;
    uploadType?: string;
    isActive?: boolean;
  }) {
    try {
      // 중복 코드 확인
      const existingMission = await this.prisma.mission.findUnique({
        where: { code: data.code }
      });

      if (existingMission) {
        throw new ConflictException('이미 존재하는 미션 코드입니다');
      }

      // 기록형 미션일 경우 recordType 필수 체크
      if (data.type === 'RECORD' && !data.recordType) {
        throw new BadRequestException('기록형 미션은 recordType이 필수입니다');
      }

      const mission = await this.prisma.mission.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description,
          points: data.points,
          requireUpload: data.requireUpload ?? false,
          sortOrder: data.sortOrder ?? 0,
          category: data.category ?? 'DAILY',
          type: data.type ?? 'MISSION',
          recordType: data.recordType,
          dailyLimit: data.dailyLimit ?? 1, // 기본값 1
          specificDay: data.specificDay,
          totalDays: data.totalDays ?? 21,
          uploadType: data.uploadType,
          isActive: data.isActive ?? true
        }
      });

      this.logger.log(`미션 생성 완료 - ${mission.name} (dailyLimit: ${mission.dailyLimit})`);
      return mission;

    } catch (error) {
      this.logger.error('미션 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 미션 정보 수정
   * @param id 미션 ID
   * @param data 수정할 데이터
   */
  async updateMission(id: number, data: {
    code?: string;
    name?: string;
    description?: string;
    points?: number;
    requireUpload?: boolean;
    sortOrder?: number;
    category?: string;
    type?: string;
    recordType?: string;
    dailyLimit?: number;
    specificDay?: number;
    totalDays?: number;
    uploadType?: string;
    isActive?: boolean;
  }) {
    try {
      // 미션 존재 여부 확인
      const existingMission = await this.prisma.mission.findUnique({
        where: { id }
      });

      if (!existingMission) {
        throw new NotFoundException('미션을 찾을 수 없습니다');
      }

      // 코드 중복 확인 (다른 미션과)
      if (data.code && data.code !== existingMission.code) {
        const duplicateCode = await this.prisma.mission.findFirst({
          where: {
            code: data.code,
            id: { not: id }
          }
        });

        if (duplicateCode) {
          throw new ConflictException('이미 존재하는 미션 코드입니다');
        }
      }

      // 기록형 미션일 경우 recordType 필수 체크
      if (data.type === 'RECORD' && !data.recordType && !existingMission.recordType) {
        throw new BadRequestException('기록형 미션은 recordType이 필수입니다');
      }

      const mission = await this.prisma.mission.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      this.logger.log(`미션 수정 완료 - ${mission.name} (dailyLimit: ${mission.dailyLimit})`);
      return mission;

    } catch (error) {
      this.logger.error('미션 수정 실패:', error);
      throw error;
    }
  }

  /**
   * 미션 삭제
   * @param id 미션 ID
   */
  async deleteMission(id: number) {
    try {
      // 미션 존재 여부 확인
      const existingMission = await this.prisma.mission.findUnique({
        where: { id },
        include: {
          challengeMissions: true
        }
      });

      if (!existingMission) {
        throw new NotFoundException('미션을 찾을 수 없습니다');
      }

      // 연결된 챌린지 미션이 있는지 확인
      if (existingMission.challengeMissions.length > 0) {
        throw new BadRequestException('챌린지에서 사용 중인 미션은 삭제할 수 없습니다');
      }

      await this.prisma.mission.delete({
        where: { id }
      });

      this.logger.log(`미션 삭제 완료 - ID: ${id}`);

    } catch (error) {
      this.logger.error('미션 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 미션 활성/비활성 전환
   * @param id 미션 ID
   */
  async toggleMissionStatus(id: number) {
    try {
      const existingMission = await this.prisma.mission.findUnique({
        where: { id }
      });

      if (!existingMission) {
        throw new NotFoundException('미션을 찾을 수 없습니다');
      }

      const mission = await this.prisma.mission.update({
        where: { id },
        data: {
          isActive: !existingMission.isActive,
          updatedAt: new Date()
        }
      });

      this.logger.log(`미션 상태 전환 - ${mission.name}: ${mission.isActive ? '활성' : '비활성'}`);
      return mission;

    } catch (error) {
      this.logger.error('미션 상태 전환 실패:', error);
      throw error;
    }
  }

  /**
   * 미션 dailyLimit 업데이트
   * @param id 미션 ID
   * @param dailyLimit 새로운 일일 제한 횟수
   */
  async updateMissionDailyLimit(id: number, dailyLimit: number) {
    try {
      const existingMission = await this.prisma.mission.findUnique({
        where: { id }
      });

      if (!existingMission) {
        throw new NotFoundException('미션을 찾을 수 없습니다');
      }

      if (dailyLimit < 1) {
        throw new BadRequestException('dailyLimit은 1 이상이어야 합니다');
      }

      const mission = await this.prisma.mission.update({
        where: { id },
        data: {
          dailyLimit,
          updatedAt: new Date()
        }
      });

      this.logger.log(`미션 dailyLimit 업데이트 - ${mission.name}: ${mission.dailyLimit}`);
      return mission;

    } catch (error) {
      this.logger.error('미션 dailyLimit 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 미션 통계 조회
   * @param id 미션 ID
   */
  async getMissionStats(id: number) {
    try {
      const mission = await this.prisma.mission.findUnique({
        where: { id }
      });

      if (!mission) {
        throw new NotFoundException('미션을 찾을 수 없습니다');
      }

      // 미션 시도 통계
      const attemptStats = await this.prisma.missionAttempt.groupBy({
        by: ['isCompleted'],
        where: {
          challengeMission: {
            missionId: id
          }
        },
        _count: {
          id: true
        }
      });

      // 일별 완료 통계 (최근 30일)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyStats = await this.prisma.missionAttempt.groupBy({
        by: ['day'],
        where: {
          challengeMission: {
            missionId: id
          },
          createdAt: {
            gte: thirtyDaysAgo
          },
          isCompleted: true
        },
        _count: {
          id: true
        },
        orderBy: {
          day: 'asc'
        }
      });

      // 챌린지별 사용 현황
      const challengeUsage = await this.prisma.challengeMission.findMany({
        where: {
          missionId: id
        },
        include: {
          challenge: {
            select: {
              name: true,
              isActive: true
            }
          }
        }
      });

      const totalAttempts = attemptStats.reduce((sum, stat) => sum + stat._count.id, 0);
      const completedAttempts = attemptStats.find(stat => stat.isCompleted)?._count.id || 0;
      const incompleteAttempts = attemptStats.find(stat => !stat.isCompleted)?._count.id || 0;

      return {
        mission: {
          id: mission.id,
          name: mission.name,
          type: mission.type,
          dailyLimit: mission.dailyLimit,
          isActive: mission.isActive
        },
        stats: {
          totalAttempts,
          completedAttempts,
          incompleteAttempts,
          completionRate: totalAttempts > 0 ? (completedAttempts / totalAttempts * 100).toFixed(1) : '0'
        },
        dailyStats,
        challengeUsage: challengeUsage.map(cu => ({
          challengeId: cu.challengeId,
          challengeName: cu.challenge.name,
          day: cu.day,
          points: cu.points,
          isActive: cu.challenge.isActive
        }))
      };

    } catch (error) {
      this.logger.error('미션 통계 조회 실패:', error);
      throw error;
    }
  }
}