import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { QuizResponseDto } from './dto/quiz-response.dto';
import { EventService } from '../event/event.service';

/**
 * 퀴즈 서비스
 * 사용자가 퀴즈를 조회하고 참여하는 기능을 제공
 * 
 * 주의: 퀴즈 생성/수정/삭제는 QuizMasterService와 EventManagementService에서 처리
 */
@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService
  ) {}

  /**
   * 특정 날짜의 퀴즈 조회 (사용자용)
   */
  async getQuizByDate(date: string): Promise<QuizResponseDto> {
    this.logger.log(`퀴즈 조회 - 날짜: ${date}`);

    // 챌린지 기간 서비스를 통해 일차 계산
    let challengeDay: number;
    try {
      challengeDay = await this.eventService.calculateChallengeDay(date);
    } catch (error) {
      // 챌린지 종료 또는 시작 전인 경우 처리
      if (error.message.includes('챌린지가 종료')) {
        // 21일 이후는 21일차 데이터 반환 (마지막 퀴즈)
        challengeDay = 21;
        this.logger.warn(`챌린지 종료 후 접근 - 21일차 퀴즈 반환: ${date}`);
      } else {
        throw error;
      }
    }

    const activePeriod = await this.eventService.getActiveEvent();
    
    // EventQuiz에서 해당 일차 퀴즈 조회
    const eventQuizzes = await this.prisma.eventQuiz.findMany({
      where: {
        eventId: activePeriod.id,
        day: challengeDay,
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
      throw new NotFoundException(`${challengeDay}일차 퀴즈를 찾을 수 없습니다.`);
    }

    // 첫 번째 퀴즈 반환 (여러 개가 있을 경우)
    const eventQuiz = eventQuizzes[0];
    const quiz = eventQuiz.quiz;

    // options 배열을 QuizOptionDto 형식으로 변환
    const optionsArray = quiz.options as string[];
    const formattedOptions = optionsArray.map((option, index) => ({
      value: index,
      label: option,
    }));

    return {
      id: eventQuiz.id,
      day: eventQuiz.day,
      question: quiz.question,
      options: formattedOptions,
      points: quiz.points || 50,
    };
  }

  /**
   * 퀴즈 답안 확인 및 해설 반환 (사용자용)
   * 
   * @param day 일차
   * @param answer 사용자 답변
   * @returns 정답 여부와 정답 번호
   */
  async checkAnswer(day: number, answer: number): Promise<{ 
    isCorrect: boolean; 
    correctAnswer: number; 
    explanation: string | null 
  }> {
    this.logger.log(`퀴즈 답안 확인 - 일차: ${day}, 답안: ${answer}`);

    const activePeriod = await this.eventService.getActiveEvent();
    
    // EventQuiz에서 해당 일차 퀴즈 조회
    const eventQuizzes = await this.prisma.eventQuiz.findMany({
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

    if (eventQuizzes.length === 0) {
      throw new NotFoundException(`${day}일차 퀴즈를 찾을 수 없습니다.`);
    }

    const eventQuiz = eventQuizzes[0];
    const quiz = eventQuiz.quiz;
    const isCorrect = quiz.correctAnswer === answer;
    
    return {
      isCorrect,
      correctAnswer: quiz.correctAnswer,
      explanation: null, // 퀴즈 마스터 테이블에 explanation 필드가 없음
    };
  }

  /**
   * 특정 이벤트의 모든 퀴즈 목록 조회 (사용자용)
   * 
   * @param eventId 이벤트 ID (없으면 현재 활성 이벤트)
   * @returns 퀴즈 목록
   */
  async getEventQuizzes(eventId?: number): Promise<any[]> {
    if (!eventId) {
      const activeEvent = await this.eventService.getActiveEvent();
      eventId = activeEvent.id;
    }

    this.logger.log(`이벤트 퀴즈 목록 조회 - 이벤트 ID: ${eventId}`);

    const quizzes = await this.prisma.eventQuiz.findMany({
      where: { 
        eventId,
        isActive: true,
      },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            question: true,
            options: true,
            points: true,
            category: true,
            difficulty: true,
          },
        },
      },
      orderBy: [
        { day: 'asc' },
        { sortOrder: 'asc' },
      ],
    });

    this.logger.log(`퀴즈 목록 조회 완료 - 총 ${quizzes.length}개`);
    return quizzes;
  }

  /**
   * 특정 일차의 퀴즈 목록 조회 (사용자용)
   * 
   * @param eventId 이벤트 ID
   * @param day 일차
   * @returns 퀴즈 리스트
   */
  async getQuizzesByDay(eventId: number, day: number): Promise<any[]> {
    this.logger.log(`퀴즈 조회 - 이벤트 ID: ${eventId}, 일차: ${day}`);

    const quizzes = await this.prisma.eventQuiz.findMany({
      where: {
        eventId,
        day,
        isActive: true,
      },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            question: true,
            options: true,
            points: true,
            category: true,
            difficulty: true,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    this.logger.log(`퀴즈 조회 완료 - 총 ${quizzes.length}개`);
    return quizzes;
  }

  /**
   * 사용자가 퀴즈를 풀었는지 확인
   * 
   * @param userId 사용자 ID
   * @param eventId 이벤트 ID
   * @param day 일차
   * @returns 퀴즈 참여 여부
   */
  async hasUserAnsweredQuiz(
    userId: number,
    eventId: number,
    day: number
  ): Promise<boolean> {
    const eventUser = await this.prisma.eventUser.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!eventUser) {
      return false;
    }

    const eventQuizzes = await this.prisma.eventQuiz.findMany({
      where: {
        eventId,
        day,
      },
    });

    if (eventQuizzes.length === 0) {
      return false;
    }

    const answers = await this.prisma.quizAnswer.count({
      where: {
        eventUserId: eventUser.id,
        eventQuizId: {
          in: eventQuizzes.map(eq => eq.id),
        },
      },
    });

    return answers > 0;
  }

  /**
   * 퀴즈 통계 조회
   * 
   * @param eventId 이벤트 ID
   * @param quizId 퀴즈 ID
   * @returns 퀴즈 통계
   */
  async getQuizStatistics(eventId: number, quizId: number): Promise<{
    totalAnswers: number;
    correctAnswers: number;
    accuracyRate: number;
  }> {
    const eventQuiz = await this.prisma.eventQuiz.findFirst({
      where: {
        eventId,
        quizId,
      },
    });

    if (!eventQuiz) {
      throw new NotFoundException(`해당 이벤트에 퀴즈가 없습니다.`);
    }

    const totalAnswers = await this.prisma.quizAnswer.count({
      where: { eventQuizId: eventQuiz.id },
    });

    const correctAnswers = await this.prisma.quizAnswer.count({
      where: {
        eventQuizId: eventQuiz.id,
        isCorrect: true,
      },
    });

    const accuracyRate = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;

    return {
      totalAnswers,
      correctAnswers,
      accuracyRate: Math.round(accuracyRate * 100) / 100,
    };
  }
}