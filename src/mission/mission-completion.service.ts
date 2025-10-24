import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { PointService } from '../point/point.service';
import { CompleteMissionDto } from './dto/mission-completion.dto';
import { Logger } from '@nestjs/common';
import { getNowKST, calculateChallengeDay } from '../common/utils/kst-date.util';

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
            status: 'ACTIVE'
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

        if (challengeMission.day !== currentDay) {
          throw new BadRequestException(`이 미션은 ${challengeMission.day}일차에만 수행할 수 있습니다 (현재: ${currentDay}일차)`);
        }

        // 3️⃣ 오늘의 미션 시도 횟수 확인
        const todayAttempts = await tx.missionAttempt.count({
          where: {
            userId,
            challengeMissionId: challengeMission.id,
            day: currentDay
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
        const textFromMetadata = metadata?.text ?? null;
        const valueFromMetadata = metadata?.value ?? null;
        const unitFromMetadata = metadata?.unit ?? null;

        let trackingRecordId: number | null = null;
        let fileUploadId: number | null = null;

        if (mission.type === 'RECORD') {
          // 기록형 미션 처리
          if (!valueFromMetadata) {
            throw new BadRequestException('기록형 미션은 기록 값이 필수입니다 (metadata.value)');
          }

          if (!mission.recordType) {
            throw new BadRequestException('기록형 미션의 recordType이 설정되지 않았습니다');
          }

          // 오늘 해당 기록 타입으로 이미 시도했는지 확인
          const todayRecordAttempts = await tx.missionAttempt.count({
            where: {
              userId,
              challengeMissionId: challengeMission.id,
              day: currentDay,
              trackingRecord: {
                recordCode: mission.recordType
              }
            }
          });

          if (todayRecordAttempts >= dailyLimit) {
            throw new ConflictException(`오늘 이미 해당 기록을 ${dailyLimit}번 완료했습니다`);
          }

          // 기록 데이터 저장 (완전한 역추적 정보 포함)
          const now = getNowKST();
          const userRecord = await tx.userRecord.create({
            data: {
              userId,
              userChallengeId: userChallenge.id,
              recordType: mission.recordType,
              date: new Date(todayStr),
              metadata: {
                // 챌린지 컨텍스트
                challengeMissionId: challengeMission.id,
                missionId: challengeMission.missionId,
                day: currentDay,
                productId: challengeMission.productId,

                // 기록 데이터 (metadata 통째로 저장)
                ...metadata
              },
              createdAt: now,
              updatedAt: now
            }
          });

          trackingRecordId = userRecord.id;
          this.logger.log(`기록 저장 완료 - ${mission.recordType}: ${valueFromMetadata} ${unitFromMetadata || ''}`);

        } else {
          // 일반 미션 처리 (1일1미션 등)
          if (mission.requireUpload && !fileUploadIdFromMetadata) {
            throw new BadRequestException('이 미션은 인증샷 업로드가 필요합니다 (metadata.fileUploadId)');
          }

          // 파일 업로드 ID 검증 (필요시)
          if (fileUploadIdFromMetadata) {
            const fileUpload = await tx.fileUpload.findFirst({
              where: {
                id: fileUploadIdFromMetadata,
                userId
              }
            });

            if (!fileUpload) {
              throw new NotFoundException('업로드된 파일을 찾을 수 없습니다');
            }

            fileUploadId = fileUploadIdFromMetadata;
          }

          // 일반 미션도 recordType이 있으면 user_records에 저장
          if (mission.recordType) {
            const now = getNowKST();

            // DAILY_MISSION이면 daily_missions 테이블에서 상세 정보 조회
            // (이미 위에서 dailyMission을 조회했으면 재사용, 아니면 새로 조회)
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

            const userRecord = await tx.userRecord.create({
              data: {
                userId,
                userChallengeId: userChallenge.id,
                recordType: mission.recordType,
                date: new Date(todayStr),
                metadata: {
                  // 챌린지 컨텍스트
                  challengeMissionId: challengeMission.id,
                  missionId: challengeMission.missionId,
                  day: currentDay,
                  productId: challengeMission.productId,

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

            trackingRecordId = userRecord.id;
            this.logger.log(`미션 데이터 저장 완료 - ${mission.recordType}: ${textFromMetadata || valueFromMetadata || 'file upload'}`);
          }

          this.logger.log(`일반 미션 시도 - ${mission.name}`);
        }

        // 7️⃣ 미션 시도 기록 생성
        const attemptNumber = todayAttempts + 1;
        const isCompleted = attemptNumber >= dailyLimit; // dailyLimit 달성 시에만 완료
        const pointsEarned = isCompleted ? challengeMission.points : 0; // 최종 완료시에만 포인트 지급

        const now = getNowKST();
        const missionAttempt = await tx.missionAttempt.create({
          data: {
            userId,
            challengeMissionId: challengeMission.id,
            userChallengeId: userChallenge.id,
            day: currentDay,
            attemptNumber,
            isCompleted,
            pointsEarned,
            fileUploadId,
            trackingRecordId,
            metadata: dto.metadata,
            createdAt: now,
            updatedAt: now
          }
        });

        // 8️⃣ 최종 완료시에만 포인트 및 진행도 업데이트
        let updatedProgress = dailyProgress;
        let user = await tx.user.findUnique({ where: { id: userId } });

        if (isCompleted) {
          // DailyProgress 업데이트
          updatedProgress = await tx.dailyProgress.update({
            where: {
              userChallengeId_day: {
                userChallengeId: userChallenge.id,
                day: currentDay
              }
            },
            data: {
              missionsCompleted: { increment: 1 },
              pointsEarned: { increment: challengeMission.points }
            }
          });

          // 사용자 총 포인트 업데이트
          await tx.userChallenge.update({
            where: { id: userChallenge.id },
            data: {
              totalPoints: { increment: challengeMission.points }
            }
          });

          // 공통 포인트 지급 서비스 사용
          await this.pointService.awardPointsInTransaction(
            tx,
            userId,
            challengeMission.points,
            `미션 완료: ${mission.name} (${attemptNumber}/${dailyLimit})`,
            'CHALLENGE_MISSION',
            challengeMission.id
          );

          this.logger.log(`미션 최종 완료 - ${mission.name}, 획득 포인트: ${challengeMission.points}`);
        } else {
          this.logger.log(`미션 시도 기록 - ${mission.name} (${attemptNumber}/${dailyLimit})`);
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
          status: 'ACTIVE'
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

      // 3️⃣ 각 미션별 오늘의 시도 횟수 조회
      const missionsWithProgress = await Promise.all(
        todayMissions.map(async (cm) => {
          const todayAttempts = await this.prisma.missionAttempt.count({
            where: {
              userId,
              challengeMissionId: cm.id,
              day: currentDay
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

      // 완료된 미션 개수 (isCompleted = true인 MissionAttempt)
      const completedMissions = await this.prisma.missionAttempt.count({
        where: {
          userChallengeId: activeChallenge.id,
          isCompleted: true
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
          status: 'ACTIVE'
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

      // 4️⃣ 미션 완료 여부 조회
      const todayAttempts = challengeMission ? await this.prisma.missionAttempt.count({
        where: {
          userId,
          challengeMissionId: challengeMission.id,
          day: currentDay
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
}