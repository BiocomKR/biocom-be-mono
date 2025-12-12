import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';
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

    // 페르소나의 personaUrl, name 조회
    const aiPersona = await this.prisma.aiPersona.findUnique({
      where: { id: user.aiPersonaId },
      select: {
        personaUrl: true,
        name: true
      }
    }); 

    // 테스트를 위해 1일차로 고정
    const challengeDay = 5;

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
    _selectedOptions: Array<{ step: number; option: number }>
  ): Promise<BalanceGameCompleteResponseDto> {
    this.logger.log(`사용자 ${userId}가 게임 ${gameId} 완료`);

    const today = getNowKST();
    today.setUTCHours(0, 0, 0, 0); // 00:00:00으로 설정

    // 이 게임을 한 번이라도 완료했는지 확인 (최초 완료 여부 체크용)
    const existingHistory = await this.prisma.userBalanceGameHistory.findFirst({
      where: {
        userId,
        gameId
      }
    });

    const isFirstCompletion = !existingHistory;

    // 보상 정보 찾기
    const resultStep = await this.prisma.balanceGameStep.findFirst({
      where: {
        gameId,
        stepType: 'RESULT',
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
          earnedCouponId: isFirstCompletion ? resultStep?.couponId : null
        }
      });

      // 쿠폰 지급 (최초 완료시에만)
      if (isFirstCompletion && resultStep?.coupon) {
        const expiresAt = getNowKST();
        expiresAt.setHours(expiresAt.getHours() + resultStep.coupon.validHours);

        await tx.userCoupon.create({
          data: {
            userId,
            couponId: resultStep.coupon.id,
            expiresAt
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
        productName: earnedCoupon.product.name,
        expiresAt: new Date(getNowKST().getTime() + earnedCoupon.validHours * 60 * 60 * 1000).toISOString()
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
        productName: step.coupon.product.name
      } : undefined
    };
  }
}