import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
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

    // 사용자 정보 조회 (캐릭터 확인)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { characterId: true }
    });

    if (!user || !user.characterId) {
      throw new NotFoundException('사용자에게 지정된 캐릭터가 없습니다');
    }

    // 테스트를 위해 1일차로 고정
    const challengeDay = 1;

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
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const hasPlayedToday = await this.prisma.userBalanceGameHistory.findFirst({
      where: {
        userId,
        gameId: game.id,
        playDate: todayStr
      }
    });

    return {
      id: game.id,
      title: game.title,
      description: game.description,
      thumbnailUrl: game.thumbnailUrl,
      backgroundUrl: game.backgroundUrl,
      hasPlayedToday: !!hasPlayedToday,
      challengeDay: challengeDay
    };
  }

  /**
   * 밸런스게임 시작 - 첫 번째 단계(질문) 반환
   */
  async startBalanceGame(userId: number, gameId: number): Promise<BalanceGameStepResponseDto> {
    this.logger.log(`사용자 ${userId}가 게임 ${gameId} 시작`);

    // 오늘 이미 플레이했는지 확인
    const today = new Date().toISOString().split('T')[0];
    const hasPlayedToday = await this.prisma.userBalanceGameHistory.findFirst({
      where: {
        userId,
        gameId,
        playDate: today
      }
    });

    if (hasPlayedToday) {
      throw new ConflictException('오늘 이미 밸런스게임을 완료했습니다');
    }

    // 사용자의 캐릭터 ID 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { characterId: true }
    });

    if (!user || !user.characterId) {
      throw new NotFoundException('사용자에게 지정된 캐릭터가 없습니다');
    }

    // 첫 번째 단계(질문) 조회 - 사용자의 캐릭터에 맞는 대사
    const firstStep = await this.prisma.balanceGameStep.findFirst({
      where: {
        gameId,
        characterId: user.characterId,
        stepNumber: 1,
        stepType: 'QUESTION',
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

    if (!firstStep) {
      throw new NotFoundException('게임의 첫 번째 단계를 찾을 수 없습니다');
    }

    return this.formatStepResponse(firstStep);
  }

  /**
   * 밸런스게임 선택 처리 - 다음 단계 반환
   */
  async makeChoice(
    userId: number,
    gameId: number,
    stepId: number,
    dto: BalanceGameChoiceDto
  ): Promise<BalanceGameProgressResponseDto> {
    this.logger.log(`사용자 ${userId}가 게임 ${gameId}, 단계 ${stepId}에서 선택 ${dto.selectedOption}`);

    // 사용자의 캐릭터 ID 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { characterId: true }
    });

    if (!user || !user.characterId) {
      throw new NotFoundException('사용자에게 지정된 캐릭터가 없습니다');
    }

    // 현재 단계 확인
    const currentStep = await this.prisma.balanceGameStep.findFirst({
      where: {
        id: stepId,
        gameId,
        characterId: user.characterId,
        isActive: true
      }
    });

    if (!currentStep) {
      throw new NotFoundException('해당 게임 단계를 찾을 수 없습니다');
    }

    // 다음 단계 찾기 (현재 단계를 부모로 하고, 선택한 옵션에 해당하는 단계)
    const nextStep = await this.prisma.balanceGameStep.findFirst({
      where: {
        gameId,
        characterId: user.characterId,
        parentStepId: stepId,
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

    if (!nextStep) {
      throw new NotFoundException('다음 단계를 찾을 수 없습니다');
    }

    // 선택 기록 업데이트 (임시 저장소 또는 세션 사용 - 여기서는 간단히 응답에 포함)
    const selectedOptions = [{ step: currentStep.stepNumber, option: dto.selectedOption }];

    return {
      gameId,
      currentStep: nextStep.stepNumber,
      selectedOptions,
      nextStep: this.formatStepResponse(nextStep)
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

    const today = new Date().toISOString().split('T')[0];

    // 오늘 이미 완료했는지 재확인
    const existingHistory = await this.prisma.userBalanceGameHistory.findFirst({
      where: {
        userId,
        gameId,
        playDate: today
      }
    });

    if (existingHistory) {
      throw new ConflictException('오늘 이미 이 게임을 완료했습니다');
    }

    // 마지막 단계에서 보상 정보 찾기
    const lastChoice = selectedOptions[selectedOptions.length - 1];
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

    // 최초 선택지 확인 (오늘 날짜로 이미 플레이한 기록이 있는지)
    const todayHistory = await this.prisma.userBalanceGameHistory.findFirst({
      where: {
        userId,
        playDate: today
      }
    });

    const isFirstChoice = !todayHistory;

    // 트랜잭션으로 완료 처리
    await this.prisma.$transaction(async (tx) => {
      // 게임 완료 기록 저장
      const history = await tx.userBalanceGameHistory.create({
        data: {
          userId,
          gameId,
          playDate: today,
          selectedOptions,
          earnedCouponId: isFirstChoice ? resultStep?.couponId : null
        }
      });

      // 쿠폰 지급 (최초 선택지에만)
      if (isFirstChoice && resultStep?.coupon) {
        const expiresAt = new Date();
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

    const message = isFirstChoice
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
        expiresAt: new Date(Date.now() + earnedCoupon.validHours * 60 * 60 * 1000).toISOString()
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