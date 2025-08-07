import { Injectable, Logger, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { EventService } from '../event/event.service';
import { QuizAnswer, EventUser, EventQuiz } from '@prisma/client';

/**
 * 퀴즈 답변 관리 서비스
 * 이벤트 참여자의 퀴즈 답변을 관리
 */
@Injectable()
export class QuizAnswerService {
  private readonly logger = new Logger(QuizAnswerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
  ) {}

  /**
   * 퀴즈 답변 제출
   * 
   * @param userId 사용자 ID
   * @param day 퀴즈 일차
   * @param selectedAnswer 선택한 답안 번호
   * @returns 퀴즈 답변 결과
   */
  async submitAnswer(
    userId: number,
    day: number,
    selectedAnswer: number,
  ): Promise<QuizAnswer & { eventQuiz: EventQuiz }> {
    this.logger.log(`퀴즈 답변 제출 - 사용자: ${userId}, 일차: ${day}, 답안: ${selectedAnswer}`);

    // 1. 현재 활성 이벤트 확인
    const activePeriod = await this.eventService.getActiveEvent();
    
    // 2. 이벤트 참여자 확인
    const eventUser = await this.getOrCreateEventUser(userId, activePeriod.id);
    
    // 3. 해당 일차 퀴즈 조회
    const eventQuiz = await this.getEventQuiz(activePeriod.id, day);
    
    // 4. 중복 답변 체크
    const existing = await this.prisma.quizAnswer.findUnique({
      where: {
        eventUserId_eventQuizId: {
          eventUserId: eventUser.id,
          eventQuizId: eventQuiz.id,
        },
      },
    });

    if (existing) {
      this.logger.warn(`퀴즈 이미 답변함 - 이벤트참여자: ${eventUser.id}, 퀴즈: ${eventQuiz.id}`);
      throw new ConflictException('이미 답변한 퀴즈입니다. 재시도는 불가능합니다.');
    }

    // 5. 정답 여부 확인
    const isCorrect = selectedAnswer === eventQuiz.quiz.correctAnswer;
    const pointsEarned = isCorrect ? eventQuiz.quiz.points : 0;

    // 6. 트랜잭션으로 답변 처리
    return await this.prisma.$transaction(async (tx) => {
      // 퀴즈 답변 기록 생성
      const answer = await tx.quizAnswer.create({
        data: {
          eventUserId: eventUser.id,
          eventQuizId: eventQuiz.id,
          selectedAnswer: selectedAnswer,
          isCorrect: isCorrect,
          pointsEarned: pointsEarned,
        },
        include: {
          eventQuiz: true,
        },
      });

      // 정답인 경우 포인트 적립
      if (isCorrect) {
        await tx.pointHistory.create({
          data: {
            userId: userId,
            type: 'EARN',
            amount: pointsEarned,
            balance: 0, // 나중에 계산
            description: `${day}일차 퀴즈 정답`,
            relatedType: 'QUIZ_ANSWER',
            relatedId: answer.id,
          },
        });

        // 사용자 포인트 업데이트
        await tx.user.update({
          where: { id: userId },
          data: {
            points: { increment: pointsEarned },
          },
        });
      }

      // 이벤트 참여자 통계 업데이트
      await this.updateEventUserStats(tx, eventUser.id);

      this.logger.log(`퀴즈 답변 처리 완료 - ID: ${answer.id}, 정답: ${isCorrect}, 포인트: ${pointsEarned}`);
      return answer;
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
   * 특정 일차 퀴즈 조회
   */
  private async getEventQuiz(eventId: number, day: number): Promise<any> {
    const eventQuizzes = await this.prisma.eventQuiz.findMany({
      where: {
        eventId: eventId,
        day: day,
        isActive: true,
      },
      include: {
        quiz: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    if (eventQuizzes.length === 0) {
      throw new NotFoundException(`${day}일차 퀴즈를 찾을 수 없습니다.`);
    }

    // 첫 번째 퀴즈를 반환 (여러 개가 있을 경우)
    return eventQuizzes[0];
  }

  /**
   * 이벤트 참여자 통계 업데이트
   */
  private async updateEventUserStats(tx: any, eventUserId: number): Promise<void> {
    // 미션 포인트
    const missionPoints = await tx.missionCompletion.aggregate({
      where: { eventUserId: eventUserId },
      _sum: { pointsEarned: true },
    });

    // 퀴즈 포인트
    const quizPoints = await tx.quizAnswer.aggregate({
      where: { eventUserId: eventUserId },
      _sum: { pointsEarned: true },
    });

    // 완료 일수 계산
    const missionDays = await tx.missionCompletion.findMany({
      where: { eventUserId: eventUserId },
      select: { day: true },
      distinct: ['day'],
    });

    const total = (missionPoints._sum.pointsEarned || 0) + (quizPoints._sum.pointsEarned || 0);

    await tx.eventUser.update({
      where: { id: eventUserId },
      data: {
        totalPoints: total,
        completedDays: missionDays.length,
      },
    });
  }

  /**
   * 특정 일차 퀴즈 정보 조회 (답변 여부 포함)
   */
  async getDayQuiz(userId: number, day: number): Promise<{
    quiz: any;
    userAnswer?: QuizAnswer;
  }> {
    const activePeriod = await this.eventService.getActiveEvent();
    
    const quizzes = await this.prisma.eventQuiz.findMany({
      where: {
        eventId: activePeriod.id,
        day: day,
        isActive: true,
      },
      include: {
        quiz: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    if (quizzes.length === 0) {
      throw new NotFoundException(`${day}일차 퀴즈를 찾을 수 없습니다.`);
    }

    const quiz = quizzes[0];

    // 사용자 답변 조회
    const eventUser = await this.prisma.eventUser.findUnique({
      where: {
        eventId_userId: {
          eventId: activePeriod.id,
          userId: userId,
        },
      },
    });

    let userAnswer: QuizAnswer | undefined;
    if (eventUser) {
      const answer = await this.prisma.quizAnswer.findUnique({
        where: {
          eventUserId_eventQuizId: {
            eventUserId: eventUser.id,
            eventQuizId: quiz.id,
          },
        },
      });
      userAnswer = answer || undefined;
    }

    return {
      quiz,
      userAnswer,
    };
  }

  /**
   * 사용자의 전체 퀴즈 답변 현황 조회
   */
  async getUserAnswers(userId: number): Promise<{
    answers: QuizAnswer[];
    totalCorrect: number;
    totalPoints: number;
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
        quizAnswers: {
          include: {
            eventQuiz: true,
          },
        },
      },
    });

    if (!eventUser) {
      return {
        answers: [],
        totalCorrect: 0,
        totalPoints: 0,
      };
    }

    const totalCorrect = eventUser.quizAnswers.filter(a => a.isCorrect).length;
    const totalPoints = eventUser.quizAnswers.reduce((sum, a) => sum + a.pointsEarned, 0);

    return {
      answers: eventUser.quizAnswers,
      totalCorrect,
      totalPoints,
    };
  }

  /**
   * 퀴즈별 답변 통계 조회 (관리자용)
   * 
   * @param quizId 퀴즈 ID
   * @returns 퀴즈 통계
   */
  async getQuizStatistics(quizId: number): Promise<{
    totalAnswers: number;
    correctAnswers: number;
    incorrectAnswers: number;
    accuracyRate: string;
    answerDistribution: { option: number; count: number }[];
  }> {
    this.logger.log(`퀴즈 통계 조회 - 퀴즈 ID: ${quizId}`);

    // 퀴즈 존재 확인
    const quiz = await this.prisma.eventQuiz.findUnique({
      where: { id: quizId }
    });

    if (!quiz) {
      throw new NotFoundException(`퀴즈를 찾을 수 없습니다: ${quizId}`);
    }

    // 전체 답변 조회
    const answers = await this.prisma.quizAnswer.findMany({
      where: { eventQuizId: quizId }
    });

    const totalAnswers = answers.length;
    const correctAnswers = answers.filter(a => a.isCorrect).length;
    const incorrectAnswers = totalAnswers - correctAnswers;
    const accuracyRate = totalAnswers > 0 
      ? (correctAnswers / totalAnswers * 100).toFixed(2) + '%' 
      : '0%';

    // 선택지별 분포
    const distribution = new Map<number, number>();
    answers.forEach(answer => {
      distribution.set(answer.selectedAnswer, (distribution.get(answer.selectedAnswer) || 0) + 1);
    });

    const answerDistribution = Array.from(distribution.entries())
      .map(([option, count]) => ({ option, count }))
      .sort((a, b) => a.option - b.option);

    this.logger.log(`퀴즈 통계 조회 완료 - 전체: ${totalAnswers}, 정답: ${correctAnswers}`);

    return {
      totalAnswers,
      correctAnswers,
      incorrectAnswers,
      accuracyRate,
      answerDistribution,
    };
  }
}