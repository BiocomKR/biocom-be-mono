import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CompleteMissionDto } from './dto/mission-completion.dto';
import { Logger } from '@nestjs/common';

/**
 * 챌린지 미션 서비스
 * 일반 미션과 기록형 미션의 완료 처리를 담당
 */
@Injectable()
export class MissionCompletionService {
  private readonly logger = new Logger(MissionCompletionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 미션 완료 처리 (일반/기록형 통합, dailyLimit 기반)
   * @param userId 사용자 ID
   * @param challengeMissionId 챌린지 미션 ID  
   * @param dto 완료 데이터
   */
  async completeMission(userId: number, challengeMissionId: number, dto: CompleteMissionDto) {
    try {
      this.logger.log(`미션 완료 처리 시작 - 사용자: ${userId}, 챌린지미션: ${challengeMissionId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1️⃣ 챌린지 미션 및 관련 정보 조회
        const challengeMission = await tx.challengeMission.findFirst({
          where: { 
            id: challengeMissionId,
            isActive: true
          },
          include: {
            mission: true,
            challenge: {
              include: {
                userChallenges: {
                  where: {
                    userId,
                    status: 'ACTIVE'
                  }
                }
              }
            }
          }
        });

        if (!challengeMission) {
          throw new NotFoundException('챌린지 미션을 찾을 수 없습니다');
        }

        if (challengeMission.challenge.userChallenges.length === 0) {
          throw new BadRequestException('활성화된 챌린지가 없습니다');
        }

        const userChallenge = challengeMission.challenge.userChallenges[0];
        const mission = challengeMission.mission;

        // 2️⃣ 오늘 날짜와 현재 일차 확인
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const currentDay = userChallenge.currentDay;

        if (challengeMission.day !== currentDay) {
          throw new BadRequestException(`이 미션은 ${challengeMission.day}일차에만 수행할 수 있습니다 (현재: ${currentDay}일차)`);
        }

        // 3️⃣ 오늘의 미션 시도 횟수 확인
        const todayAttempts = await tx.missionAttempt.count({
          where: {
            userId,
            challengeMissionId,
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
          dailyProgress = await tx.dailyProgress.create({
            data: {
              userChallengeId: userChallenge.id,
              day: currentDay,
              date: new Date(todayStr)
            }
          });
        }

        // 6️⃣ 미션 타입에 따른 처리 분기
        let trackingRecordId: number | null = null;
        let fileUploadId: number | null = null;

        if (mission.type === 'RECORD') {
          // 기록형 미션 처리
          if (!dto.value) {
            throw new BadRequestException('기록형 미션은 기록 값이 필수입니다');
          }

          if (!mission.recordType) {
            throw new BadRequestException('기록형 미션의 recordType이 설정되지 않았습니다');
          }

          // 오늘 해당 기록 타입으로 이미 시도했는지 확인
          const todayRecordAttempts = await tx.missionAttempt.count({
            where: {
              userId,
              challengeMissionId,
              day: currentDay,
              trackingRecord: {
                recordCode: mission.recordType
              }
            }
          });

          if (todayRecordAttempts >= dailyLimit) {
            throw new ConflictException(`오늘 이미 해당 기록을 ${dailyLimit}번 완료했습니다`);
          }

          // 기록 데이터 저장
          const userRecord = await tx.userRecord.create({
            data: {
              userId,
              userChallengeId: userChallenge.id,
              recordCode: mission.recordType,
              date: new Date(todayStr),
              value: dto.value,
              unit: dto.unit || null,
              metadata: dto.metadata || null
            }
          });

          trackingRecordId = userRecord.id;
          this.logger.log(`기록 저장 완료 - ${mission.recordType}: ${dto.value} ${dto.unit || ''}`);

        } else {
          // 일반 미션 처리
          if (mission.requireUpload && !dto.fileUploadId) {
            throw new BadRequestException('이 미션은 인증샷 업로드가 필요합니다');
          }

          // 파일 업로드 ID 검증 (필요시)
          if (dto.fileUploadId) {
            const fileUpload = await tx.fileUpload.findFirst({
              where: { 
                id: dto.fileUploadId,
                userId 
              }
            });

            if (!fileUpload) {
              throw new NotFoundException('업로드된 파일을 찾을 수 없습니다');
            }

            fileUploadId = dto.fileUploadId;
          }

          this.logger.log(`일반 미션 시도 - ${mission.name}`);
        }

        // 7️⃣ 미션 시도 기록 생성
        const attemptNumber = todayAttempts + 1;
        const isCompleted = attemptNumber >= dailyLimit; // dailyLimit 달성 시에만 완료
        const pointsEarned = isCompleted ? challengeMission.points : 0; // 최종 완료시에만 포인트 지급

        const missionAttempt = await tx.missionAttempt.create({
          data: {
            userId,
            challengeMissionId,
            userChallengeId: userChallenge.id,
            day: currentDay,
            attemptNumber,
            isCompleted,
            pointsEarned,
            fileUploadId,
            trackingRecordId,
            metadata: dto.metadata
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

          // 포인트 히스토리 기록
          user = await tx.user.update({
            where: { id: userId },
            data: {
              points: { increment: challengeMission.points }
            }
          });

          await tx.pointHistory.create({
            data: {
              userId,
              type: 'EARNED',
              amount: challengeMission.points,
              balance: user.points,
              description: `미션 완료: ${mission.name} (${attemptNumber}/${dailyLimit})`,
              relatedType: 'CHALLENGE_MISSION',
              relatedId: challengeMissionId
            }
          });

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
          attemptedAt: new Date(),
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
          challenge: true
        }
      });

      if (!activeChallenge) {
        throw new NotFoundException('활성화된 챌린지가 없습니다');
      }

      const currentDay = activeChallenge.currentDay;

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

      this.logger.log(`일일 미션 진행도 - 달성률: ${totalMissionAvg}% (${completedMissions}/${totalMissions})`);

      return {
        success: true,
        data: {
          totalMissionAvg,
          mission: missionsWithProgress
        },
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error('일일 미션 진행도 조회 실패:', error);
      throw error;
    }
  }
}