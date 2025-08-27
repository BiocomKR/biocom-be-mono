import { Injectable, Logger, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { EventService } from '../event/event.service';
import { MissionCompletion, EventUser, EventMission } from '@prisma/client';

/**
 * 미션 완료 관리 서비스
 * 이벤트 참여자의 미션 수행 기록을 관리
 */
@Injectable()
export class MissionCompletionService {
  private readonly logger = new Logger(MissionCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
  ) {}

  /**
   * 미션 완료 처리
   * 
   * @param userId 사용자 ID
   * @param missionCode 미션 코드
   * @param day 수행 일차
   * @param fileUploadId 인증 파일 ID (선택)
   * @returns 미션 완료 정보
   */
  async completeMission(
    userId: number,
    missionCode: string,
    day: number,
    fileUploadId?: number,
  ): Promise<MissionCompletion> {
    this.logger.log(`미션 완료 처리 시작 - 사용자: ${userId}, 미션: ${missionCode}, 일차: ${day}`);

    // 1. 현재 활성 이벤트 확인
    const activePeriod = await this.eventService.getActiveEvent();
    
    // 2. 이벤트 참여자 확인
    const eventUser = await this.getOrCreateEventUser(userId, activePeriod.id);
    
    // 3. 이벤트-미션 관계 확인
    const eventMission = await this.getEventMission(activePeriod.id, missionCode, day);
    
    // 4. 중복 완료 체크
    const existing = await this.prisma.missionCompletion.findUnique({
      where: {
        eventUserId_eventMissionId_day: {
          eventUserId: eventUser.id,
          eventMissionId: eventMission.id,
          day: day,
        },
      },
    });

    if (existing) {
      this.logger.warn(`미션 이미 완료됨 - 이벤트참여자: ${eventUser.id}, 이벤트미션: ${eventMission.id}, 일차: ${day}`);
      throw new ConflictException('이미 완료한 미션입니다.');
    }

    // 5. 파일 업로드 필수 체크
    if (eventMission.mission.requireUpload && !fileUploadId) {
      throw new BadRequestException('이 미션은 인증 사진이 필요합니다.');
    }

    // 6. 트랜잭션으로 미션 완료 처리
    return await this.prisma.$transaction(async (tx) => {
      // 미션 완료 기록 생성
      const completion = await tx.missionCompletion.create({
        data: {
          eventUserId: eventUser.id,
          eventMissionId: eventMission.id,
          day: day,
          pointsEarned: eventMission.points,
          fileUploadId: fileUploadId,
        },
        include: {
          eventMission: {
            include: {
              mission: true,
            },
          },
        },
      });

      // 사용자 포인트 업데이트
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: eventMission.points },
        },
      });

      // 포인트 적립 이력 (실제 잔액 포함)
      await tx.pointHistory.create({
        data: {
          userId: userId,
          type: 'EARN',
          amount: eventMission.points,
          balance: updatedUser.points, // 실제 잔액
          description: `${eventMission.mission.name} 완료`,
          relatedType: 'MISSION_COMPLETION',
          relatedId: completion.id,
        },
      });

      // EventUser.totalPoints 제거됨 - 필요시 SUM 쿼리로 계산

      this.logger.log(`미션 완료 처리 성공 - ID: ${completion.id}, 포인트: ${eventMission.points}`);
      return completion;
    });
  }

  /**
   * 이벤트 참여자 조회 또는 생성
   */
  private async getOrCreateEventUser(userId: number, eventId: number): Promise<EventUser> {
    let eventUser = await this.prisma.eventUser.findUnique({
      where: {
        eventId_userId: {
          eventId: eventId,
          userId: userId,
        },
      },
    });

    if (!eventUser) {
      eventUser = await this.prisma.eventUser.create({
        data: {
          eventId: eventId,
          userId: userId,
          status: 'ACTIVE',
        },
      });
      this.logger.log(`새 이벤트 참여자 생성 - ID: ${eventUser.id}`);
    }

    return eventUser;
  }

  /**
   * 이벤트-미션 관계 조회
   */
  private async getEventMission(
    eventId: number,
    missionCode: string,
    day: number,
  ): Promise<EventMission & { mission: any }> {
    const eventMission = await this.prisma.eventMission.findFirst({
      where: {
        eventId: eventId,
        mission: {
          code: missionCode,
          isActive: true,
        },
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

    if (!eventMission) {
      throw new NotFoundException(`미션을 찾을 수 없습니다: ${missionCode}`);
    }

    return eventMission;
  }

  /**
   * 이벤트 참여자 통계 조회 (실시간 계산)
   * EventUser.totalPoints 제거로 인해 필요시 SUM으로 계산
   */
  async getEventUserStats(eventUserId: number): Promise<{
    totalPoints: number;
    completedDays: number;
  }> {
    // 미션 포인트 합계
    const missionPoints = await this.prisma.missionCompletion.aggregate({
      where: { eventUserId },
      _sum: { pointsEarned: true },
    });

    // 퀴즈 포인트 합계
    const quizPoints = await this.prisma.quizAnswer.aggregate({
      where: { eventUserId },
      _sum: { pointsEarned: true },
    });

    // 완료 일수 (중복 제거)
    const completedDays = await this.prisma.missionCompletion.findMany({
      where: { eventUserId },
      select: { day: true },
      distinct: ['day'],
    });

    return {
      totalPoints: (missionPoints._sum.pointsEarned || 0) + (quizPoints._sum.pointsEarned || 0),
      completedDays: completedDays.length,
    };
  }

  /**
   * 특정 일차의 미션 완료 목록 조회
   */
  async getDayCompletions(
    userId: number,
    day: number,
  ): Promise<(MissionCompletion & { eventMission: { mission: any } })[]> {
    const activePeriod = await this.eventService.getActiveEvent();
    
    const eventUser = await this.prisma.eventUser.findUnique({
      where: {
        eventId_userId: {
          eventId: activePeriod.id,
          userId: userId,
        },
      },
    });

    if (!eventUser) {
      return [];
    }

    return await this.prisma.missionCompletion.findMany({
      where: {
        eventUserId: eventUser.id,
        day: day,
      },
      include: {
        eventMission: {
          include: {
            mission: true,
          },
        },
        fileUpload: true,
      },
    });
  }

  /**
   * 사용자의 전체 미션 완료 현황 조회
   */
  async getUserCompletions(userId: number): Promise<{
    completions: MissionCompletion[];
    totalPoints: number;
    completedDays: number;
  }> {
    const activePeriod = await this.eventService.getActiveEvent();
    
    const eventUser = await this.prisma.eventUser.findUnique({
      where: {
        eventId_userId: {
          eventId: activePeriod.id,
          userId: userId,
        },
      },
      include: {
        missionCompletions: {
          include: {
            eventMission: {
              include: {
                mission: true,
              },
            },
          },
        },
      },
    });

    if (!eventUser) {
      return {
        completions: [],
        totalPoints: 0,
        completedDays: 0,
      };
    }

    // EventUser.totalPoints 제거로 인해 실시간 계산
    const stats = await this.getEventUserStats(eventUser.id);
    
    return {
      completions: eventUser.missionCompletions,
      totalPoints: stats.totalPoints,
      completedDays: stats.completedDays,
    };
  }
}