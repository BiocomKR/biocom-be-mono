import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CompleteQuizDto } from './dto/quiz-completion.dto';
import { Logger } from '@nestjs/common';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 퀴즈 서비스
 * 퀴즈 답변 제출, 채점 및 챌린지 연동
 */
@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 퀴즈 완료 처리
   * @param userId 사용자 ID
   * @param quizId 퀴즈 ID
   * @param dto 답변 데이터
   */
  async completeQuiz(userId: number, quizId: number, dto: CompleteQuizDto) {
    try {
      this.logger.log(`퀴즈 완료 처리 시작 - 사용자: ${userId}, 퀴즈: ${quizId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1️⃣ 퀴즈 조회
        const quiz = await tx.quiz.findFirst({
          where: { 
            id: quizId,
            isActive: true
          }
        });

        if (!quiz) {
          throw new NotFoundException('퀴즈를 찾을 수 없습니다');
        }

        // 2️⃣ 답변 번호 유효성 검증
        if (dto.selectedAnswer < 0 || dto.selectedAnswer >= quiz.options.length) {
          throw new BadRequestException('올바르지 않은 답변 번호입니다');
        }

        // 3️⃣ 활성 챌린지 조회
        const activeChallenge = await tx.userChallenge.findFirst({
          where: {
            userId,
            status: 'ACTIVE'
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                metadata: true
              }
            }
          }
        });

        let challengeInfo = null;
        let userChallengeId = null;
        let isFromChallenge = false;

        if (activeChallenge) {
          userChallengeId = activeChallenge.id;
          const metadata = activeChallenge.product.metadata as any;
          challengeInfo = {
            productId: activeChallenge.productId,
            challengeName: metadata?.challengeName || activeChallenge.product.name,
            currentDay: activeChallenge.currentDay
          };

          // 오늘의 챌린지 퀴즈인지 확인
          const todayQuiz = await tx.challengeQuiz.findFirst({
            where: {
              productId: activeChallenge.productId,
              day: activeChallenge.currentDay,
              quizId: quizId,
              isActive: true
            }
          });

          if (todayQuiz) {
            isFromChallenge = true;
            
            // 이미 답변했는지 확인
            const existingAnswer = await tx.quizAnswer.findFirst({
              where: {
                userId,
                challengeQuizId: todayQuiz.id
              }
            });

            if (existingAnswer) {
              throw new ConflictException('이미 답변한 퀴즈입니다');
            }
          }
        }

        // 4️⃣ 정답 채점
        const isCorrect = dto.selectedAnswer === quiz.correctAnswer;
        const pointsEarned = isCorrect ? (quiz.points || 50) : 0;

        // 5️⃣ 퀴즈 답변 저장
        const quizAnswerData: any = {
          userId,
          quizId,
          selectedAnswer: dto.selectedAnswer,
          isCorrect,
          pointsEarned,
          timeSpent: dto.timeSpent || null,
          note: dto.note || null,
          answeredAt: getNowKST()
        };

        if (isFromChallenge) {
          // 챌린지 퀴즈 답변
          const challengeQuiz = await tx.challengeQuiz.findFirst({
            where: {
              productId: activeChallenge!.productId,
              day: activeChallenge!.currentDay,
              quizId: quizId
            }
          });
          quizAnswerData.challengeQuizId = challengeQuiz!.id;
        }

        const quizAnswer = await tx.quizAnswer.create({
          data: quizAnswerData
        });

        // 6️⃣ 챌린지 연동 처리 (정답일 때만 포인트 적립)
        if (isFromChallenge && isCorrect && activeChallenge) {
          await this.processChallengeIntegration(tx, activeChallenge, pointsEarned, quiz.title);
        }

        const result = {
          quiz: {
            id: quiz.id,
            title: quiz.title,
            question: quiz.question,
            correctAnswer: quiz.correctAnswer
          },
          selectedAnswer: dto.selectedAnswer,
          isCorrect,
          pointsEarned,
          timeSpent: dto.timeSpent,
          answeredAt: quizAnswer.answeredAt,
          challengeInfo
        };

        this.logger.log(`퀴즈 완료 처리 성공 - ${quiz.title}, 정답: ${isCorrect}, 포인트: ${pointsEarned}`);
        return { success: true, data: result };
      });

    } catch (error) {
      this.logger.error('퀴즈 완료 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 챌린지 연동 처리
   * 퀴즈 정답 시 포인트 적립 및 진행상황 업데이트
   */
  private async processChallengeIntegration(
    tx: any, 
    activeChallenge: any, 
    pointsEarned: number, 
    quizTitle: string
  ) {
    try {
      // 1️⃣ DailyProgress 조회/생성
      const today = getNowKST();
      const todayStr = today.toISOString().split('T')[0];

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

      // 2️⃣ DailyProgress 업데이트 (정답 개수 증가)
      await tx.dailyProgress.update({
        where: {
          userChallengeId_day: {
            userChallengeId: activeChallenge.id,
            day: activeChallenge.currentDay
          }
        },
        data: {
          quizzesCorrect: { increment: 1 },
          pointsEarned: { increment: pointsEarned }
        }
      });

      // 3️⃣ 사용자 총 포인트 업데이트
      await tx.userChallenge.update({
        where: { id: activeChallenge.id },
        data: {
          totalPoints: { increment: pointsEarned }
        }
      });

      // 4️⃣ 포인트 히스토리 기록
      const user = await tx.user.update({
        where: { id: activeChallenge.userId },
        data: {
          points: { increment: pointsEarned }
        }
      });

      await tx.pointHistory.create({
        data: {
          userId: activeChallenge.userId,
          type: 'EARNED',
          amount: pointsEarned,
          balance: user.points,
          description: `퀴즈 정답: ${quizTitle}`,
          relatedType: 'QUIZ',
          relatedId: activeChallenge.id
        }
      });

      this.logger.log(`퀴즈 챌린지 연동 성공 - ${quizTitle}, 포인트: ${pointsEarned}`);

    } catch (error) {
      this.logger.error('퀴즈 챌린지 연동 실패:', error);
      // 챌린지 연동 실패해도 퀴즈 답변은 저장됨
    }
  }
}