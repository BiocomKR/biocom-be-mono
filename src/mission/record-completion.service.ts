import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CompleteRecordDto } from './dto/record-completion.dto';
import { PointService } from '../point/point.service';
import { Logger } from '@nestjs/common';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 기록 서비스
 * 사용자 기록 생성 및 연관 미션 자동 처리
 */
@Injectable()
export class RecordCompletionService {
  private readonly logger = new Logger(RecordCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService,
  ) {}

  /**
   * 기록 완료 처리
   * @param userId 사용자 ID
   * @param recordId 기록 항목 ID (RecordItem.id)
   * @param dto 기록 데이터
   */
  async completeRecord(userId: number, recordId: number, dto: CompleteRecordDto) {
    try {
      this.logger.log(`기록 완료 처리 시작 - 사용자: ${userId}, 기록항목: ${recordId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1️⃣ 기록 항목 조회
        const recordItem = await tx.recordItem.findFirst({
          where: { id: recordId }
        });

        if (!recordItem) {
          throw new NotFoundException('기록 항목을 찾을 수 없습니다');
        }

        // 2️⃣ 오늘 날짜 확인
        const today = getNowKST();
        const todayStr = today.toISOString().split('T')[0];

        // 3️⃣ 이미 오늘 기록했는지 확인
        const existingRecord = await tx.userRecord.findFirst({
          where: {
            userId,
            recordCode: recordItem.code,
            date: new Date(todayStr)
          }
        });

        if (existingRecord) {
          throw new ConflictException('오늘 이미 해당 기록을 완료했습니다');
        }

        // 4️⃣ 활성 챌린지 및 연관 미션 조회
        const activeChallenge = await tx.userChallenge.findFirst({
          where: {
            userId,
            status: 'ACTIVE'
          }
        });

        let missionCompletion = null;
        let userChallengeId = null;

        if (activeChallenge) {
          userChallengeId = activeChallenge.id;

          // 오늘의 해당 기록타입 미션 찾기
          const relatedMission = await tx.challengeMission.findFirst({
            where: {
              productId: activeChallenge.productId,
              day: activeChallenge.currentDay,
              isActive: true,
              mission: {
                type: 'RECORD',
                recordType: recordItem.code
              }
            },
            include: { mission: true }
          });

          if (relatedMission) {
            this.logger.log(`연관 미션 발견 - ${relatedMission.mission.name}`);
            
            // 미션 완료 처리를 위한 정보 저장
            missionCompletion = {
              challengeMissionId: relatedMission.id,
              missionName: relatedMission.mission.name,
              points: relatedMission.points
            };
          }
        }

        // 5️⃣ 기록 데이터 저장
        const userRecord = await tx.userRecord.create({
          data: {
            userId,
            userChallengeId,
            recordCode: recordItem.code,
            date: new Date(todayStr),
            value: dto.value,
            unit: dto.unit || null,
            metadata: dto.metadata || null
          }
        });

        this.logger.log(`기록 저장 완료 - ${recordItem.code}: ${dto.value} ${dto.unit || ''}`);

        // 6️⃣ 연관 미션이 있다면 미션 완료 처리
        let finalMissionCompletion = null;

        if (missionCompletion && activeChallenge) {
          // DailyProgress 조회/생성
          let dailyProgress = await tx.dailyProgress.findFirst({
            where: {
              userChallengeId: activeChallenge.id,
              day: activeChallenge.currentDay
            }
          });

          if (!dailyProgress) {
            dailyProgress = await tx.dailyProgress.create({
              data: {
                userChallengeId: activeChallenge.id,
                day: activeChallenge.currentDay,
                date: new Date(todayStr)
              }
            });
          }

          // DailyProgress 업데이트
          await tx.dailyProgress.update({
            where: {
              userChallengeId_day: {
                userChallengeId: activeChallenge.id,
                day: activeChallenge.currentDay
              }
            },
            data: {
              missionsCompleted: { increment: 1 },
              pointsEarned: { increment: missionCompletion.points }
            }
          });

          // 사용자 총 포인트 업데이트
          await tx.userChallenge.update({
            where: { id: activeChallenge.id },
            data: {
              totalPoints: { increment: missionCompletion.points }
            }
          });

          // 공통 포인트 지급 서비스 사용
          await this.pointService.awardPointsInTransaction(
            tx,
            userId,
            missionCompletion.points,
            `미션 완료: ${missionCompletion.missionName}`,
            'CHALLENGE_MISSION',
            missionCompletion.challengeMissionId
          );

          finalMissionCompletion = {
            missionId: missionCompletion.challengeMissionId,
            missionName: missionCompletion.missionName,
            pointsEarned: missionCompletion.points
          };

          this.logger.log(`연관 미션 완료 처리 완료 - ${missionCompletion.missionName}, 획득 포인트: ${missionCompletion.points}`);
        }

        const result = {
          record: {
            id: userRecord.id,
            recordType: recordItem.code,
            value: userRecord.value,
            unit: userRecord.unit
          },
          recordedAt: userRecord.createdAt,
          missionCompletion: finalMissionCompletion
        };

        this.logger.log(`기록 완료 처리 성공 - ${recordItem.code}: ${dto.value}`);
        return { success: true, data: result };
      });

    } catch (error) {
      this.logger.error('기록 완료 처리 실패:', error);
      throw error;
    }
  }
}