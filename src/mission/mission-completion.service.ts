import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserChallengeStatus } from '../common/enums';
import { PointService } from '../point/point.service';
import { CompleteMissionDto } from './dto/mission-completion.dto';
import { Logger } from '@nestjs/common';
import { getNowKST, calculateChallengeDay, stringToKSTDate } from '../common/utils/kst-date.util';

/**
 * 챌린지 미션 서비스
 * 일반 미션과 기록형 미션의 완료 처리를 담당
 */
@Injectable()
export class MissionCompletionService {
  private readonly logger = new Logger(MissionCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService,
  ) {}

  /**
   * 미션 완료 처리 (일반/기록형 통합, dailyLimit 기반)
   * @param userId 사용자 ID
   * @param dto 완료 데이터 (challengeMissionId, dailyMissionId 포함)
   */
  async completeMission(userId: number, dto: CompleteMissionDto) {
    try {
      this.logger.log(`미션 완료 처리 시작 - 사용자: ${userId}, 챌린지미션: ${dto.challengeMissionId}, 데일리미션: ${dto.dailyMissionId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1️⃣ 챌린지 미션 및 관련 정보 조회
        const challengeMission = await tx.challengeMission.findFirst({
          where: {
            id: dto.challengeMissionId,
            isActive: true
          },
          include: {
            mission: true,
            product: true
          }
        });

        if (!challengeMission) {
          throw new NotFoundException('챌린지 미션을 찾을 수 없습니다');
        }

        // 2️⃣ dailyMissionId가 있으면 daily_missions 테이블에서 검증 (1일1미션 등)
        let dailyMission = null;
        if (dto.dailyMissionId) {
          dailyMission = await tx.dailyMission.findFirst({
            where: {
              id: dto.dailyMissionId,
              missionId: challengeMission.missionId,
              day: challengeMission.day,
              isActive: true
            }
          });

          if (!dailyMission) {
            throw new NotFoundException('데일리 미션을 찾을 수 없거나 챌린지 미션과 일치하지 않습니다');
          }
        }

        // 활성화된 사용자 챌린지 조회
        const userChallenge = await tx.userChallenge.findFirst({
          where: {
            userId,
            productId: challengeMission.productId,
            status: UserChallengeStatus.ACTIVE
          }
        });

        if (!userChallenge) {
          throw new BadRequestException('활성화된 챌린지가 없습니다');
        }

        const mission = challengeMission.mission;

        // 2️⃣ 오늘 날짜와 현재 일차 확인
        const today = getNowKST();
        const todayStr = today.toISOString().split('T')[0];
        // activatedAt 기준으로 현재 챌린지 일차 계산
        const currentDay = calculateChallengeDay(userChallenge.activatedAt);

        // 미래 미션은 수행 불가 (과거/당일 미션만 가능)
        if (challengeMission.day > currentDay) {
          throw new BadRequestException(`아직 수행할 수 없는 미션입니다 (${challengeMission.day}일차 미션, 현재: ${currentDay}일차)`);
        }

        // 3️⃣ 오늘의 미션 시도 횟수 확인 (user_records 기반)
        const todayAttempts = await tx.userRecord.count({
          where: {
            userId,
            userChallengeId: userChallenge.id,
            date: new Date(todayStr),
            metadata: {
              path: ['challengeMissionId'],
              equals: challengeMission.id
            }
          }
        });

        // 4️⃣ dailyLimit 체크
        const dailyLimit = mission.dailyLimit;
        if (todayAttempts >= dailyLimit) {
          throw new BadRequestException(`이 미션은 하루에 최대 ${dailyLimit}번만 수행할 수 있습니다 (완료: ${todayAttempts}/${dailyLimit})`);
        }

        // 5️⃣ DailyProgress 확인/생성
        let dailyProgress = await tx.dailyProgress.findFirst({
          where: {
            userChallengeId: userChallenge.id,
            day: currentDay
          }
        });

        if (!dailyProgress) {
          const now = getNowKST();
          dailyProgress = await tx.dailyProgress.create({
            data: {
              userChallengeId: userChallenge.id,
              day: currentDay,
              date: new Date(todayStr),
              createdAt: now,
              updatedAt: now
            }
          });
        }

        // 6️⃣ metadata에서 필요한 데이터 안전하게 추출 (undefined 방지)
        const metadata = dto.metadata ?? {};
        const fileUploadIdFromMetadata = metadata?.fileUploadId ?? null;
        const valueFromMetadata = metadata?.value ?? null;
        const unitFromMetadata = metadata?.unit ?? null;

        let fileUploadId: number | null = null;

        if (mission.type === 'RECORD') {
          // 기록형 미션 처리
          if (!valueFromMetadata) {
            throw new BadRequestException('기록형 미션은 기록 값이 필수입니다 (metadata.value)');
          }

          if (!mission.recordType) {
            throw new BadRequestException('기록형 미션의 recordType이 설정되지 않았습니다');
          }

          // 오늘 해당 기록 타입으로 이미 시도했는지 확인 (user_records 기반)
          const todayRecordAttempts = await tx.userRecord.count({
            where: {
              userId,
              userChallengeId: userChallenge.id,
              recordType: mission.recordType,
              date: new Date(todayStr)
            }
          });

          if (todayRecordAttempts >= dailyLimit) {
            throw new ConflictException(`오늘 이미 해당 기록을 ${dailyLimit}번 완료했습니다`);
          }

          // 기록 데이터 저장은 아래 공통 로직에서 처리
          this.logger.log(`기록형 미션 검증 완료 - ${mission.recordType}: ${valueFromMetadata} ${unitFromMetadata || ''}`);

        } else {
          // 일반 미션 처리 (1일1미션 등)
          if (mission.requireUpload && !fileUploadIdFromMetadata) {
            throw new BadRequestException('이 미션은 인증샷 업로드가 필요합니다 (metadata.fileUploadId)');
          }

          // 파일 업로드 ID 검증 (필요시)
          if (fileUploadIdFromMetadata) {
            const userFile = await tx.userFile.findFirst({
              where: {
                id: fileUploadIdFromMetadata,
                userId
              }
            });

            if (!userFile) {
              throw new NotFoundException('업로드된 파일을 찾을 수 없습니다');
            }

            fileUploadId = fileUploadIdFromMetadata;
          }

          this.logger.log(`일반 미션 검증 완료 - ${mission.name}`);
        }

        // 7️⃣ 미션 시도 기록 생성
        const attemptNumber = todayAttempts + 1;
        const isCompleted = attemptNumber >= dailyLimit; // dailyLimit 달성 시에만 완료

        /**
         * 포인트 지급 로직
         *
         * [용어 정의]
         * - dailyLimit: 일일 참여 제한 횟수 (이 횟수만큼 참여해야 미션 "완료" 처리)
         *   예) 식단 기록 dailyLimit=9 → 9번 기록해야 완료
         *
         * - maxPointsPerDay: 일일 포인트 지급 제한 횟수 (이 횟수까지만 포인트 지급)
         *   예) 식단 기록 maxPointsPerDay=3 → 1~3회차까지만 포인트 지급, 4~9회차는 기록만
         *
         * [지급 조건]
         * 1. ONCE 미션(자기선언문, 나칭찬하기): visibleFromDay~visibleToDay 범위 내에서 1회 수행 시 포인트 지급
         * 2. DAILY 미션: 지정된 일차(challengeMission.day)에 수행한 경우만 포인트 지급
         * 3. maxPointsPerDay가 설정된 경우: attemptNumber <= maxPointsPerDay 까지 매회 포인트 지급
         * 4. maxPointsPerDay가 없는 경우: dailyLimit 달성 시 1회만 포인트 지급 (기존 로직)
         *
         * [예시]
         * - 자기선언문 (frequency=ONCE, visibleFromDay=1, visibleToDay=10)
         *   → 1~10일차 중 언제든 1회 수행 시 1000P
         * - 식단 기록 (dailyLimit=9, maxPointsPerDay=3, points=100)
         *   → 1회차: 100P, 2회차: 100P, 3회차: 100P, 4~9회차: 0P (총 300P)
         * - 공복 시간 기록 (dailyLimit=1, maxPointsPerDay=null, points=100)
         *   → 1회차(완료): 100P (총 100P)
         */
        const isOnceMission = mission.frequency === 'ONCE';
        const isWithinVisibleRange = isOnceMission
          ? (currentDay >= (mission.visibleFromDay ?? 1) && currentDay <= (mission.visibleToDay ?? 21))
          : false;
        const isOnScheduledDay = challengeMission.day === currentDay;
        const maxPointsCount = mission.maxPointsPerDay ?? null;

        let pointsEarned = 0;
        // ONCE 미션: 노출 기간 내 1회 수행 시 포인트 지급
        // DAILY 미션: 지정 일차에 수행 시 포인트 지급
        if (isOnceMission ? isWithinVisibleRange : isOnScheduledDay) {
          if (maxPointsCount !== null) {
            // maxPointsPerDay 설정됨: 해당 횟수까지 매 시도마다 포인트 지급
            if (attemptNumber <= maxPointsCount) {
              pointsEarned = challengeMission.points;
            }
          } else {
            // maxPointsPerDay 미설정: dailyLimit 달성(완료) 시에만 포인트 지급
            if (isCompleted) {
              pointsEarned = challengeMission.points;
            }
          }
        }

        const now = getNowKST();

        // DAILY_MISSION이면 daily_missions 테이블에서 상세 정보 조회
        let dailyMissionData = dailyMission;
        if (mission.recordType === 'DAILY_MISSION' && !dailyMissionData) {
          dailyMissionData = await tx.dailyMission.findFirst({
            where: {
              missionId: mission.id,
              day: currentDay,
              isActive: true
            }
          });
        }

        // 7️⃣ user_records에 미션 기록 저장 (user_missions 대체)
        const userRecord = await tx.userRecord.create({
          data: {
            userId,
            userChallengeId: userChallenge.id,
            recordType: mission.recordType || 'MISSION',
            date: new Date(todayStr),
            metadata: {
              // 챌린지 컨텍스트
              challengeMissionId: challengeMission.id,
              missionId: challengeMission.missionId,
              missionName: mission.name,
              missionType: mission.type,
              day: currentDay,
              productId: challengeMission.productId,

              // 미션 진행 정보 (기존 user_missions 필드)
              attemptNumber,
              isCompleted,
              pointsEarned,
              fileUploadId,

              // DAILY_MISSION 상세 정보
              ...(dailyMissionData && {
                dailyMissionId: dailyMissionData.id,
                title: dailyMissionData.title,
                description: dailyMissionData.description,
                verifyType: dailyMissionData.verifyType,
                imageUrl: dailyMissionData.imageUrl,
                reason: dailyMissionData.reason,
                method: dailyMissionData.method
              }),

              // 실제 수행 데이터 (metadata 통째로 저장)
              ...metadata
            },
            createdAt: now,
            updatedAt: now
          }
        });

        const trackingRecordId = userRecord.id;

        // 8️⃣ 포인트 지급 및 진행도 업데이트
        let updatedProgress = dailyProgress;

        if (pointsEarned > 0) {
          // DailyProgress 업데이트
          updatedProgress = await tx.dailyProgress.update({
            where: {
              userChallengeId_day: {
                userChallengeId: userChallenge.id,
                day: currentDay
              }
            },
            data: {
              missionsCompleted: isCompleted ? { increment: 1 } : undefined,
              pointsEarned: { increment: pointsEarned }
            }
          });

          // 사용자 총 포인트 업데이트
          await tx.userChallenge.update({
            where: { id: userChallenge.id },
            data: {
              totalPoints: { increment: pointsEarned }
            }
          });

          // 공통 포인트 지급 서비스 사용
          await this.pointService.awardPointsInTransaction(
            tx,
            userId,
            pointsEarned,
            `미션 완료: ${mission.name} (${attemptNumber}/${dailyLimit})`,
            'CHALLENGE_MISSION',
            challengeMission.id,
          );

          this.logger.log(`미션 포인트 지급 - ${mission.name}, 획득 포인트: ${pointsEarned} (${attemptNumber}/${maxPointsCount ?? dailyLimit}회)`);
        } else if (!isOnScheduledDay) {
          this.logger.log(`미션 완료 (지정 일차 아님) - ${mission.name}, 포인트 지급 없음 (${challengeMission.day}일차 미션, 현재: ${currentDay}일차)`);
        } else {
          this.logger.log(`미션 시도 기록 - ${mission.name} (${attemptNumber}/${dailyLimit}), 포인트 지급 한도 초과`);
        }

        const result = {
          mission: {
            id: mission.id,
            name: mission.name,
            type: mission.type,
            dailyLimit: mission.dailyLimit,
            current: attemptNumber,
            isCompleted
          },
          pointsEarned,
          attemptedAt: getNowKST(),
          trackingRecordId,
          todayProgress: {
            missionsCompleted: updatedProgress.missionsCompleted,
            pointsEarned: updatedProgress.pointsEarned
          }
        };

        this.logger.log(`미션 처리 완료 - ${mission.name}, 진행도: ${attemptNumber}/${dailyLimit}`);
        return { success: true, data: result };
      });

    } catch (error) {
      this.logger.error('미션 완료 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 일일 미션 진행도 조회 (메인화면용)
   * @param userId 사용자 ID
   */
  async getDailyProgress(userId: number) {
    try {
      this.logger.log(`일일 미션 진행도 조회 - 사용자: ${userId}`);

      // 1️⃣ 활성화된 사용자 챌린지 조회
      const activeChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: UserChallengeStatus.ACTIVE
        },
        include: {
          product: true
        }
      });

      if (!activeChallenge) {
        throw new NotFoundException('활성화된 챌린지가 없습니다');
      }

      // activatedAt 기준으로 현재 챌린지 일차 계산
      const currentDay = calculateChallengeDay(activeChallenge.activatedAt);

      // 2️⃣ 오늘의 미션 목록 조회
      const todayMissions = await this.prisma.challengeMission.findMany({
        where: {
          challengeId: activeChallenge.challengeId,
          day: currentDay,
          isActive: true
        },
        include: {
          mission: true
        },
        orderBy: {
          sortOrder: 'asc'
        }
      });

      // 오늘 날짜
      const today = getNowKST();
      const todayStr = today.toISOString().split('T')[0];

      // 3️⃣ 각 미션별 오늘의 시도 횟수 조회 (user_records 기반)
      const missionsWithProgress = await Promise.all(
        todayMissions.map(async (cm) => {
          const todayAttempts = await this.prisma.userRecord.count({
            where: {
              userId,
              userChallengeId: activeChallenge.id,
              date: new Date(todayStr),
              metadata: {
                path: ['challengeMissionId'],
                equals: cm.id
              }
            }
          });

          const isCompleted = todayAttempts >= cm.mission.dailyLimit;

          return {
            id: cm.id,
            name: cm.mission.name,
            type: cm.mission.type,
            dailyLimit: cm.mission.dailyLimit,
            current: todayAttempts,
            isCompleted
          };
        })
      );

      // 4️⃣ 전체 미션 달성률 계산
      // 전체 미션 개수 (모든 일차의 미션)
      const totalMissions = await this.prisma.challengeMission.count({
        where: {
          challengeId: activeChallenge.challengeId,
          isActive: true
        }
      });

      // 완료된 미션 개수 (user_records에서 isCompleted = true인 기록)
      const completedMissions = await this.prisma.userRecord.count({
        where: {
          userId,
          userChallengeId: activeChallenge.id,
          metadata: {
            path: ['isCompleted'],
            equals: true
          }
        }
      });

      // 완료율 계산 (100%를 초과하지 않도록)
      const totalMissionAvg = totalMissions > 0 
        ? Math.min(Math.round((completedMissions / totalMissions) * 100), 100)
        : 0;

      this.logger.log(`일일 미션 진행도 - 달성률: ${totalMissionAvg}% (${completedMissions}/${totalMissions}), 현재 ${currentDay}일차`);

      return {
        success: true,
        data: {
          currentDay,  // 현재 챌린지 일차
          totalMissionAvg,
          mission: missionsWithProgress
        },
        timestamp: getNowKST()
      };

    } catch (error) {
      this.logger.error('일일 미션 진행도 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 오늘의 1일 1미션 조회
   * @param userId 사용자 ID
   * @description daily_missions 테이블에서 오늘의 1일 1미션 조회
   */
  async getDailyMission(userId: number) {
    try {
      this.logger.log(`오늘의 1일 1미션 조회 - 사용자: ${userId}`);

      // 1️⃣ 활성화된 사용자 챌린지 조회
      const activeChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: UserChallengeStatus.ACTIVE
        },
        include: {
          product: true
        }
      });

      if (!activeChallenge) {
        throw new NotFoundException('활성화된 챌린지가 없습니다');
      }

      // activatedAt 기준으로 현재 챌린지 일차 계산
      const currentDay = calculateChallengeDay(activeChallenge.activatedAt);

      // 2️⃣ daily_missions 테이블에서 오늘의 1일1미션 조회
      const dailyMission = await this.prisma.dailyMission.findFirst({
        where: {
          day: currentDay,
          isActive: true
        },
        include: {
          mission: true
        }
      });

      if (!dailyMission) {
        return {
          success: true,
          data: {
            currentDay,
            mission: null,
            message: '오늘의 1일 1미션이 없습니다'
          }
        };
      }

      // 3️⃣ challenge_missions에서 해당 미션 정보 조회 (완료 체크를 위해)
      const challengeMission = await this.prisma.challengeMission.findFirst({
        where: {
          productId: activeChallenge.productId,
          missionId: dailyMission.missionId,
          day: currentDay,
          isActive: true
        }
      });

      if (!challengeMission) {
        this.logger.warn(`challenge_missions에 해당 미션이 없음 - day: ${currentDay}, missionId: ${dailyMission.missionId}`);
      }

      // 오늘 날짜
      const today = getNowKST();
      const todayStr = today.toISOString().split('T')[0];

      // 4️⃣ 미션 완료 여부 조회 (user_records 기반)
      const todayAttempts = challengeMission ? await this.prisma.userRecord.count({
        where: {
          userId,
          userChallengeId: activeChallenge.id,
          date: new Date(todayStr),
          metadata: {
            path: ['challengeMissionId'],
            equals: challengeMission.id
          }
        }
      }) : 0;

      const isCompleted = todayAttempts >= dailyMission.mission.dailyLimit;

      this.logger.log(`오늘의 1일 1미션 조회 완료 - ${dailyMission.title} (완료: ${isCompleted})`);

      return {
        success: true,
        data: {
          currentDay,
          mission: {
            challengeMissionId: challengeMission?.id,
            dailyMissionId: dailyMission.id,
            title: dailyMission.title,
            description: dailyMission.description,
            verifyType: dailyMission.verifyType,
            imageUrl: dailyMission.imageUrl,
            reason: dailyMission.reason,
            method: dailyMission.method,
            points: dailyMission.points,
            dailyLimit: dailyMission.mission.dailyLimit,
            current: todayAttempts,
            isCompleted
          }
        }
      };

    } catch (error) {
      this.logger.error('오늘의 1일 1미션 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 완료한 미션 목록 조회 (일자별)
   * @param userId 사용자 ID
   * @param startDate 시작일 (YYYY-MM-DD)
   * @param endDate 종료일 (YYYY-MM-DD)
   */
  async getCompletedMissions(userId: number, startDate: string, endDate: string) {
    try {
      this.logger.log(`완료한 미션 목록 조회 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}`);

      // 1️⃣ 활성화된 사용자 챌린지 조회
      const activeChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: UserChallengeStatus.ACTIVE
        }
      });

      if (!activeChallenge) {
        throw new NotFoundException('활성화된 챌린지가 없습니다');
      }

      // 2️⃣ 날짜 범위를 KST 기준 Date로 변환 (createdAt 기준 조회)
      const startDateTime = stringToKSTDate(startDate); // 시작일 00:00:00 KST
      const endDateTime = stringToKSTDate(endDate, 24, 0, 0); // 종료일 다음날 00:00:00 KST

      this.logger.log(`날짜 범위 (createdAt 기준): ${startDate} ~ ${endDate}`);

      // 3️⃣ 완료한 미션 조회 (user_records 기반, isCompleted = true, createdAt 기준)
      const completedRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          userChallengeId: activeChallenge.id,
          createdAt: {
            gte: startDateTime,
            lt: endDateTime
          },
          metadata: {
            path: ['isCompleted'],
            equals: true
          }
        },
        orderBy: [
          { createdAt: 'asc' }
        ]
      });

      // 4️⃣ 일자별로 그룹핑
      const missionsByDay = completedRecords.reduce((acc, record) => {
        const metadata = record.metadata as any;
        const day = metadata?.day;
        if (!day) return acc;

        if (!acc[day]) {
          acc[day] = [];
        }

        acc[day].push({
          id: record.id,
          recordType: record.recordType,
          title: metadata.missionName || this.getRecordTypeTitle(record.recordType),
          points: metadata.pointsEarned || 0,
          completedAt: record.createdAt
        });

        return acc;
      }, {} as Record<number, any[]>);

      this.logger.log(`완료한 미션 조회 완료 - 총 ${completedRecords.length}개`);

      return {
        success: true,
        data: {
          dateRange: { startDate, endDate },
          missions: missionsByDay,
          totalCount: completedRecords.length
        }
      };

    } catch (error) {
      this.logger.error('완료한 미션 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 놓친 미션 목록 조회 (일자별)
   * @param userId 사용자 ID
   * @param startDate 시작일 (YYYY-MM-DD)
   * @param endDate 종료일 (YYYY-MM-DD)
   */
  async getMissedMissions(userId: number, startDate: string, endDate: string) {
    try {
      this.logger.log(`놓친 미션 목록 조회 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}`);

      // 1️⃣ 활성화된 사용자 챌린지 조회
      const activeChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: UserChallengeStatus.ACTIVE
        },
        include: {
          product: true
        }
      });

      if (!activeChallenge) {
        throw new NotFoundException('활성화된 챌린지가 없습니다');
      }

      // 2️⃣ 현재 일차 계산 및 날짜 범위 설정
      const currentDay = calculateChallengeDay(activeChallenge.activatedAt);

      // 날짜 범위를 KST 기준 Date로 변환 (createdAt 기준 조회)
      const startDateTime = stringToKSTDate(startDate); // 시작일 00:00:00 KST
      const endDateTime = stringToKSTDate(endDate, 24, 0, 0); // 종료일 다음날 00:00:00 KST

      this.logger.log(`놓친 미션 조회 - 날짜 범위: ${startDate} ~ ${endDate}, 현재: ${currentDay}일차`);

      // 3️⃣ 해당 기간의 전체 챌린지 미션 조회 (1일차 ~ 어제까지, 당일/미래 제외)
      // 놓친 미션은 "이미 지나간 날"의 미완료 미션만 해당
      const maxDayForMissed = currentDay - 1;

      // 1일차인 경우 놓친 미션 없음 (아직 지나간 날이 없음)
      if (maxDayForMissed < 1) {
        this.logger.log(`놓친 미션 없음 - 현재 ${currentDay}일차 (아직 지나간 날이 없음)`);
        return {
          success: true,
          data: {
            dateRange: { startDate, endDate },
            currentDay,
            missions: {},
            totalCount: 0
          }
        };
      }

      const allMissions = await this.prisma.challengeMission.findMany({
        where: {
          challengeId: activeChallenge.challengeId,
          day: {
            gte: 1,
            lte: maxDayForMissed  // 어제(currentDay - 1)까지만 조회
          },
          isActive: true
        },
        include: {
          mission: true
        },
        orderBy: [
          { day: 'asc' },
          { sortOrder: 'asc' }
        ]
      });

      // 4️⃣ 해당 기간에 완료한 미션 ID 목록 조회 (user_records 기반, createdAt 기준)
      const completedRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          userChallengeId: activeChallenge.id,
          createdAt: {
            gte: startDateTime,
            lt: endDateTime
          },
          metadata: {
            path: ['isCompleted'],
            equals: true
          }
        },
        select: {
          metadata: true
        }
      });

      const completedIds = new Set(
        completedRecords
          .map(r => (r.metadata as any)?.challengeMissionId)
          .filter(id => id !== undefined)
      );

      // 5️⃣ 놓친 미션 필터링 (완료하지 않은 미션)
      const missedMissions = allMissions.filter(cm => !completedIds.has(cm.id));

      // 6️⃣ 일자별로 그룹핑
      const missionsByDay = missedMissions.reduce((acc, cm) => {
        if (!acc[cm.day]) {
          acc[cm.day] = [];
        }

        acc[cm.day].push({
          challengeMissionId: cm.id,
          missionId: cm.mission.id,
          missionName: cm.mission.name,
          missionType: cm.mission.type,
          originalPoints: cm.points, // 원래 받을 수 있었던 포인트
          currentPoints: 0, // 지금 완료하면 0점
          dailyLimit: cm.mission.dailyLimit,
          requireUpload: cm.mission.requireUpload
        });

        return acc;
      }, {} as Record<number, any[]>);

      this.logger.log(`놓친 미션 조회 완료 - 총 ${missedMissions.length}개`);

      return {
        success: true,
        data: {
          dateRange: { startDate, endDate },
          currentDay,
          missions: missionsByDay,
          totalCount: missedMissions.length
        }
      };

    } catch (error) {
      this.logger.error('놓친 미션 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 자기선언문/칭찬내역 조회
   * @param userId 사용자 ID
   * @description 활성화된 챌린지의 자기선언문(1일차), 칭찬내역(10일차) 조회
   */
  async getRecords(userId: number) {
    try {
      this.logger.log(`자기선언문/칭찬내역 조회 - 사용자: ${userId}`);

      // 1️⃣ 활성화된 사용자 챌린지 조회
      const activeChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: UserChallengeStatus.ACTIVE
        }
      });

      if (!activeChallenge) {
        throw new NotFoundException('활성화된 챌린지가 없습니다');
      }

      // 2️⃣ missions 테이블에서 DECLARATION, SELF_PRAISE 타입 미션 조회
      const recordMissions = await this.prisma.mission.findMany({
        where: {
          recordType: {
            in: ['DECLARATION', 'SELF_PRAISE']
          },
          isActive: true
        },
        select: {
          id: true,
          recordType: true,
          specificDay: true
        }
      });

      if (recordMissions.length === 0) {
        return {
          success: true,
          data: []
        };
      }

      // 3️⃣ 각 미션에 대한 user_records 조회
      const results = await Promise.all(
        recordMissions.map(async (mission) => {
          // user_records에서 해당 recordType 기록 조회
          const userRecord = await this.prisma.userRecord.findFirst({
            where: {
              userId,
              userChallengeId: activeChallenge.id,
              recordType: mission.recordType,
              metadata: {
                path: ['isCompleted'],
                equals: true
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          });

          if (!userRecord) {
            return null;
          }

          // metadata에서 contents 추출
          const metadata = userRecord.metadata as any;
          const contents = metadata?.contents || metadata?.text || null;

          return {
            type: mission.recordType,
            day: mission.specificDay,
            contents,
            completedAt: userRecord.createdAt,
            pointsEarned: metadata?.pointsEarned || 0
          };
        })
      );

      // null 제거 및 타입별 정렬
      const records = results
        .filter(r => r !== null)
        .sort((a, b) => a.day - b.day);

      this.logger.log(`자기선언문/칭찬내역 조회 완료 - 총 ${records.length}개`);

      return {
        success: true,
        data: records
      };

    } catch (error) {
      this.logger.error('자기선언문/칭찬내역 조회 실패:', error);
      throw error;
    }
  }

  /**
   * recordType으로 미션 정보 조회
   * @param userId 사용자 ID
   * @param recordType 미션 기록 타입 (DECLARATION, SELF_PRAISE 등)
   * @description ID 없이 recordType만으로 미션 정보와 완료 여부 조회
   */
  async getMissionByRecordType(userId: number, recordType: string) {
    try {
      this.logger.log(`recordType으로 미션 조회 - 사용자: ${userId}, recordType: ${recordType}`);

      // 1️⃣ 활성화된 사용자 챌린지 조회
      const activeChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: UserChallengeStatus.ACTIVE
        },
        include: {
          product: true
        }
      });

      if (!activeChallenge) {
        throw new NotFoundException('활성화된 챌린지가 없습니다');
      }

      // 2️⃣ recordType으로 미션 마스터 조회
      const mission = await this.prisma.mission.findFirst({
        where: {
          recordType,
          isActive: true
        }
      });

      if (!mission) {
        throw new NotFoundException(`${recordType} 타입의 미션을 찾을 수 없습니다`);
      }

      // 3️⃣ 해당 챌린지의 challengeMission 조회
      const challengeMission = await this.prisma.challengeMission.findFirst({
        where: {
          productId: activeChallenge.productId,
          missionId: mission.id,
          isActive: true
        }
      });

      if (!challengeMission) {
        throw new NotFoundException(`현재 챌린지에 ${recordType} 미션이 설정되어 있지 않습니다`);
      }

      // 4️⃣ 현재 챌린지 일차 계산
      const currentDay = calculateChallengeDay(activeChallenge.activatedAt);

      // 5️⃣ 이미 완료했는지 확인
      const existingRecord = await this.prisma.userRecord.findFirst({
        where: {
          userId,
          userChallengeId: activeChallenge.id,
          recordType
        }
      });

      const isCompleted = !!existingRecord;
      const isAvailable = challengeMission.day <= currentDay;

      return {
        success: true,
        data: {
          challengeMissionId: challengeMission.id,
          missionId: mission.id,
          name: mission.name,
          description: mission.description,
          points: challengeMission.points,
          recordType: mission.recordType,
          verifyType: mission.verifyType,
          requireUpload: mission.requireUpload,
          day: challengeMission.day,
          currentDay,
          isCompleted,
          isAvailable,
          completedAt: existingRecord?.createdAt || null,
          contents: isCompleted ? (existingRecord?.metadata as any)?.text || (existingRecord?.metadata as any)?.contents : null
        }
      };

    } catch (error) {
      this.logger.error(`recordType 미션 조회 실패 - ${recordType}:`, error);
      throw error;
    }
  }

  /**
   * recordType으로 미션 제출
   * @param userId 사용자 ID
   * @param recordType 미션 기록 타입
   * @param metadata 제출 데이터
   * @description ID 없이 recordType만으로 미션 제출. 내부에서 challengeMissionId를 찾아 completeMission 호출
   */
  async submitMissionByRecordType(userId: number, recordType: string, metadata: { text?: string; fileUploadId?: number }) {
    try {
      this.logger.log(`recordType으로 미션 제출 - 사용자: ${userId}, recordType: ${recordType}`);

      // 1️⃣ 먼저 미션 정보 조회
      const missionInfo = await this.getMissionByRecordType(userId, recordType);

      if (missionInfo.data.isCompleted) {
        throw new BadRequestException('이미 완료한 미션입니다');
      }

      if (!missionInfo.data.isAvailable) {
        throw new BadRequestException(`아직 수행할 수 없는 미션입니다 (${missionInfo.data.day}일차 미션, 현재: ${missionInfo.data.currentDay}일차)`);
      }

      // 2️⃣ 기존 completeMission 호출
      const result = await this.completeMission(userId, {
        challengeMissionId: missionInfo.data.challengeMissionId,
        metadata
      });

      return result;

    } catch (error) {
      this.logger.error(`recordType 미션 제출 실패 - ${recordType}:`, error);
      throw error;
    }
  }

  /**
   * recordType에 따른 기본 타이틀 반환
   */
  private getRecordTypeTitle(recordType: string): string {
    const titles: Record<string, string> = {
      'BEAUTY': '뷰티 점수 측정',
      'DIET': '식사 기록',
      'FASTING': '공복 시간 기록',
      'SLEEP': '수면 기록',
      'SUPPLEMENT': '영양제 섭취 기록',
      'ACTIVITY': '운동 기록',
      'QUIZ': '퀴즈',
      'DAILY_CONTENT': '콘텐츠 시청',
      'DAILY_MISSION': '1일 1미션',
      'BALANCE_GAME': '밸런스 게임',
      'WEEKLY_REPORT': '주간 리포트',
      'DECLARATION': '자기선언문',
      'SELF_PRAISE': '자기칭찬',
      'AFTER_SURVEY': '사후설문',
    };
    return titles[recordType] || recordType;
  }
}