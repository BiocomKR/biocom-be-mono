import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST, calculateChallengeDay } from '../../common/utils/kst-date.util';
import { UserChallengeStatus, PointRelatedType } from '../../common/enums';
import {
  TodayBalanceGameResponseDto,
  BalanceGameStepResponseDto,
  BalanceGameChoiceDto,
  BalanceGameCompleteResponseDto,
  BalanceGameProgressResponseDto,
  StepType
} from '../dto/balance-game.dto';

@Injectable()
export class BalanceGameService {
  private readonly logger = new Logger(BalanceGameService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 오늘의 밸런스게임 조회 (챌린지 일차 기반)
   * 사용자의 챌린지 진행일차에 맞는 게임을 반환하고, 이미 플레이했는지 여부 확인
   */
  async getTodayBalanceGame(userId: number): Promise<TodayBalanceGameResponseDto> {
    this.logger.log(`사용자 ${userId}의 오늘 밸런스게임 조회`);

    // 사용자 정보 조회 (AI 페르소나 확인)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { aiPersonaId: true }
    });

    if (!user || !user.aiPersonaId) {
      throw new NotFoundException('사용자에게 지정된 AI 페르소나가 없습니다');
    }

    // 페르소나의 torsoBgUrl, personaUrl, name 조회
    const aiPersona = await this.prisma.aiPersona.findUnique({
      where: { id: user.aiPersonaId },
      select: {
        torsoBgUrl: true,
        personaUrl: true,
        name: true
      }
    });

    // 사용자의 활성 챌린지 조회
    const activeChallenge = await this.prisma.userChallenge.findFirst({
      where: {
        userId,
        status: UserChallengeStatus.ACTIVE
      },
      select: { activatedAt: true }
    });

    if (!activeChallenge) {
      throw new NotFoundException('활성화된 챌린지가 없습니다');
    }

    // 챌린지 일차 계산
    const challengeDay = calculateChallengeDay(activeChallenge.activatedAt);

    // 해당 일차의 게임 찾기
    const game = await this.prisma.balanceGame.findFirst({
      where: {
        challengeDay: challengeDay,
        isActive: true
      }
    });

    if (!game) {
      throw new NotFoundException(`${challengeDay}일차에 해당하는 밸런스게임이 없습니다`);
    }

    // 오늘 이미 플레이했는지 확인
    const today = getNowKST();
    today.setUTCHours(0, 0, 0, 0); // 00:00:00으로 설정
    const hasPlayedToday = await this.prisma.userBalanceGameHistory.findFirst({
      where: {
        userId,
        gameId: game.id,
        playDate: today
      }
    });

    return {
      id: game.id,
      title: game.title,
      description: game.description,
      personaUrl: aiPersona?.personaUrl,
      torsoBgUrl: aiPersona?.torsoBgUrl,
      personaName: aiPersona?.name,
      // thumbnailUrl: game.thumbnailUrl,
      // backgroundUrl: game.backgroundUrl,
      hasPlayedToday: !!hasPlayedToday,
      challengeDay: challengeDay
    };
  }


  /**
   * 밸런스게임 단계 조회 - stepNumber에 해당하는 질문 정보 반환
   */
  async getGameStep(
    userId: number,
    gameId: number,
    stepNumber: number,
    dto?: BalanceGameChoiceDto
  ): Promise<BalanceGameProgressResponseDto> {
    this.logger.log(`사용자 ${userId}가 게임 ${gameId}, ${stepNumber}단계 조회`);

    // 사용자의 AI 페르소나 ID 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { aiPersonaId: true }
    });

    if (!user || !user.aiPersonaId) {
      throw new NotFoundException('사용자에게 지정된 AI 페르소나가 없습니다');
    }

    let currentStep: any;

    if (stepNumber === 1) {
      // 1단계: stepNumber만으로 조회
      currentStep = await this.prisma.balanceGameStep.findFirst({
        where: {
          gameId,
          aiPersonaId: user.aiPersonaId,
          stepNumber: 1,
          isActive: true
        },
        include: {
          coupon: {
            include: {
              product: true
            }
          }
        }
      });
    } else {
      // 2단계 이후: stepNumber + parentStepId + selectedOption으로 조회
      if (!dto?.parentStepId || !dto?.selectedOption) {
        throw new NotFoundException('2단계부터는 parentStepId와 selectedOption이 필요합니다');
      }

      currentStep = await this.prisma.balanceGameStep.findFirst({
        where: {
          gameId,
          aiPersonaId: user.aiPersonaId,
          stepNumber,
          parentStepId: dto.parentStepId,
          selectedOption: dto.selectedOption,
          isActive: true
        },
        include: {
          coupon: {
            include: {
              product: true
            }
          }
        }
      });
    }

    if (!currentStep) {
      throw new NotFoundException(`${stepNumber}단계를 찾을 수 없습니다`);
    }

    return {
      gameId,
      step: this.formatStepResponse(currentStep)
    };
  }

  /**
   * 밸런스게임 완료 처리
   */
  async completeBalanceGame(
    userId: number,
    gameId: number,
    selectedOptions: Array<{ step: number; option: number }>
  ): Promise<BalanceGameCompleteResponseDto> {
    this.logger.log(`사용자 ${userId}가 게임 ${gameId} 완료`);

    const today = getNowKST();
    today.setUTCHours(0, 0, 0, 0); // 00:00:00으로 설정

    // 사용자의 AI 페르소나 ID 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { aiPersonaId: true }
    });

    if (!user || !user.aiPersonaId) {
      throw new NotFoundException('사용자에게 지정된 AI 페르소나가 없습니다');
    }

    // 이 게임을 한 번이라도 완료했는지 확인 (최초 완료 여부 체크용)
    const existingHistory = await this.prisma.userBalanceGameHistory.findFirst({
      where: {
        userId,
        gameId
      }
    });

    const isFirstCompletion = !existingHistory;

    // selectedOptions의 마지막 항목에서 RESULT 스텝의 stepNumber 추출
    const lastSelectedOption = selectedOptions?.[selectedOptions.length - 1];
    if (!lastSelectedOption) {
      throw new NotFoundException('선택 옵션 정보가 없습니다');
    }

    // 보상 정보 찾기 - 마지막 stepNumber와 aiPersonaId로 정확한 RESULT 스텝 조회
    const resultStep = await this.prisma.balanceGameStep.findFirst({
      where: {
        gameId,
        stepNumber: lastSelectedOption.step,
        stepType: 'RESULT',
        aiPersonaId: user.aiPersonaId,
        isActive: true
      },
      include: {
        coupon: {
          include: {
            product: true
          }
        }
      }
    });

    this.logger.log(`RESULT 스텝 조회 - gameId: ${gameId}, stepNumber: ${lastSelectedOption.step}, aiPersonaId: ${user.aiPersonaId}, couponId: ${resultStep?.couponId}`);

    let earnedCoupon = null;

    // 트랜잭션으로 완료 처리
    await this.prisma.$transaction(async (tx) => {
      // 게임 완료 기록 저장 (선택 기록 없이 완료 여부만)
      await tx.userBalanceGameHistory.create({
        data: {
          userId,
          gameId,
          playDate: today,
          selectedOptions: [], // 빈 배열로 저장
          earnedCouponId: isFirstCompletion ? resultStep?.couponId : null,
          completedAt: getNowKST(),
        }
      });

      // user_records에도 기록 추가 (홈 미션목록 완료 판단용)
      const activeChallenge = await tx.userChallenge.findFirst({
        where: {
          userId,
          status: UserChallengeStatus.ACTIVE
        }
      });

      if (activeChallenge) {
        const currentDay = calculateChallengeDay(activeChallenge.activatedAt);
        const todayStr = today.toISOString().split('T')[0];

        // BALANCE_GAME 미션 정보 조회
        const mission = await tx.mission.findFirst({
          where: {
            recordType: 'BALANCE_GAME',
            isActive: true
          }
        });

        // challengeMission 조회
        const challengeMission = mission ? await tx.challengeMission.findFirst({
          where: {
            productId: activeChallenge.productId,
            missionId: mission.id,
            day: currentDay,
            isActive: true
          }
        }) : null;

        await tx.userRecord.create({
          data: {
            userId,
            userChallengeId: activeChallenge.id,
            recordType: 'BALANCE_GAME',
            date: new Date(todayStr),
            metadata: {
              gameId,
              isCompleted: true,
              isFirstCompletion,
              day: currentDay,
              challengeMissionId: challengeMission?.id || null,
              missionId: mission?.id || null,
              missionName: mission?.name || '밸런스게임',
              pointsEarned: challengeMission ? challengeMission.points : 0,
            },
            createdAt: getNowKST(),
            updatedAt: getNowKST()
          }
        });

        // 포인트 지급 (챌린지 미션이 있고, 오늘 아직 지급 안 했을 때만)
        if (challengeMission && challengeMission.points > 0) {
          // 오늘 이미 포인트 지급했는지 확인
          const todayStart = new Date(todayStr);
          const todayEnd = new Date(todayStr);
          todayEnd.setDate(todayEnd.getDate() + 1);

          const existingPointHistory = await tx.pointHistory.findFirst({
            where: {
              userId,
              relatedType: PointRelatedType.BALANCE_GAME,
              relatedId: gameId,
              createdAt: {
                gte: todayStart,
                lt: todayEnd
              }
            }
          });

          if (!existingPointHistory) {
            const pointsToAward = challengeMission.points;

            // 사용자 포인트 증가
            const updatedUser = await tx.user.update({
              where: { id: userId },
              data: { points: { increment: pointsToAward } }
            });

            // 포인트 히스토리 기록
            await tx.pointHistory.create({
              data: {
                userId,
                type: 'EARNED',
                amount: pointsToAward,
                balance: updatedUser.points,
                description: `밸런스게임 완료 (${currentDay}일차)`,
                relatedType: PointRelatedType.BALANCE_GAME,
                relatedId: gameId,
                createdAt: getNowKST()
              }
            });

            this.logger.log(`사용자 ${userId}에게 밸런스게임 포인트 ${pointsToAward}점 지급 완료`);
          } else {
            this.logger.log(`사용자 ${userId}는 오늘 이미 밸런스게임 포인트를 받았습니다`);
          }
        }
      }

      // 쿠폰 지급 (최초 완료시에만)
      if (isFirstCompletion && resultStep?.coupon) {
        const expiresAt = getNowKST();
        expiresAt.setHours(expiresAt.getHours() + resultStep.coupon.validHours);

        await tx.userCoupon.create({
          data: {
            userId,
            couponId: resultStep.coupon.id,
            issuedAt: getNowKST(),
            expiresAt,
          }
        });
        earnedCoupon = resultStep.coupon;
      }
    });

    const message = isFirstCompletion
      ? '밸런스게임을 완료했습니다!'
      : '다시 플레이했습니다! (쿠폰은 최초 1회만 지급됩니다)';

    return {
      success: true,
      message,
      earnedCoupon: earnedCoupon ? {
        id: earnedCoupon.id,
        name: earnedCoupon.name,
        description: earnedCoupon.description,
        discountType: earnedCoupon.discountType,
        discountValue: earnedCoupon.discountValue,
        productName: earnedCoupon.product?.name,
        expiresAt: new Date(getNowKST().getTime() + earnedCoupon.validHours * 60 * 60 * 1000).toISOString(),
        imageUrl: earnedCoupon.imageUrl
      } : undefined
    };
  }


  /**
   * 밸런스게임 단계 응답 포맷팅
   */
  private formatStepResponse(step: any): BalanceGameStepResponseDto {
    return {
      id: step.id,
      stepNumber: step.stepNumber,
      stepType: step.stepType as StepType,
      title: step.title,
      content: step.content,
      options: step.options,
      coupon: step.coupon ? {
        id: step.coupon.id,
        name: step.coupon.name,
        description: step.coupon.description,
        discountType: step.coupon.discountType,
        discountValue: step.coupon.discountValue,
        productName: step.coupon.product?.name,
        imageUrl: step.coupon.imageUrl
      } : undefined
    };
  }
}