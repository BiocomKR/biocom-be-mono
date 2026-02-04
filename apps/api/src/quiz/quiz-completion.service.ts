import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { PointService } from '../point/point.service';
import { CompleteQuizDto } from './dto/quiz-completion.dto';
import { Logger } from '@nestjs/common';
import { getNowKST, calculateChallengeDay } from '../common/utils/kst-date.util';
import { PointRelatedType } from '../common/enums';
import { getPointDescription } from '../common/utils/point-description.util';

/**
 * 퀴즈 완료 서비스
 * 퀴즈 답변 제출, 채점 및 챌린지 연동
 */
@Injectable()
export class QuizCompletionService {
  private readonly logger = new Logger(QuizCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService
  ) {}

  /**
   * 퀴즈 완료 처리
   * @param userId 사용자 ID
   * @param dto 답변 데이터 (challengeMissionId, quizId 포함)
   */
  async completeQuiz(userId: number, dto: CompleteQuizDto) {
    try {
      this.logger.log(`퀴즈 완료 처리 시작 - 사용자: ${userId}, 챌린지미션: ${dto.challengeMissionId}, 퀴즈: ${dto.quizId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1️⃣ challengeMission 조회 (검증 강화)
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

        // 2️⃣ MissionQuiz를 통해 퀴즈 조회 (missionId, quizId, day 모두 검증)
        const missionQuiz = await tx.missionQuiz.findFirst({
          where: {
            missionId: challengeMission.missionId,
            quizId: dto.quizId,
            day: challengeMission.day,
            isActive: true
          },
          include: {
            quiz: true
          }
        });

        if (!missionQuiz || !missionQuiz.quiz) {
          throw new NotFoundException('퀴즈를 찾을 수 없거나 챌린지 미션과 일치하지 않습니다');
        }

        const quiz = missionQuiz.quiz;

        if (!quiz.isActive) {
          throw new NotFoundException('비활성화된 퀴즈입니다');
        }

        // 3️⃣ 답변 번호 유효성 검증
        if (dto.selectedAnswer < 1 || dto.selectedAnswer > (quiz.options as any[]).length) {
          throw new BadRequestException('올바르지 않은 답변 번호입니다');
        }

        // 4️⃣ 활성 챌린지 조회
        const activeChallenge = await tx.userChallenge.findFirst({
          where: {
            userId,
            productId: challengeMission.productId,
            status: 'ACTIVE'
          }
        });

        if (!activeChallenge) {
          throw new NotFoundException('활성화된 챌린지가 없습니다');
        }

        // activatedAt 기준으로 현재 챌린지 일차 계산
        const currentDay = calculateChallengeDay(activeChallenge.activatedAt);

        // 일차 검증
        if (challengeMission.day !== currentDay) {
          throw new BadRequestException(`오늘은 ${currentDay}일차입니다. 이 퀴즈는 ${challengeMission.day}일차 퀴즈입니다.`);
        }

        const now = getNowKST();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 5️⃣ 이미 정답을 맞췄는지 확인 (user_records 기반)
        const correctAttempt = await tx.userRecord.findFirst({
          where: {
            userId,
            userChallengeId: activeChallenge.id,
            recordType: 'QUIZ',
            date: today,
            metadata: {
              path: ['challengeMissionId'],
              equals: challengeMission.id
            },
            AND: {
              metadata: {
                path: ['isCorrect'],
                equals: true
              }
            }
          }
        });

        if (correctAttempt) {
          throw new ConflictException('이미 정답을 맞춘 퀴즈입니다');
        }

        // 기존 시도 횟수 확인 (user_records 기반)
        const attemptCount = await tx.userRecord.count({
          where: {
            userId,
            userChallengeId: activeChallenge.id,
            recordType: 'QUIZ',
            date: today,
            metadata: {
              path: ['challengeMissionId'],
              equals: challengeMission.id
            }
          }
        });

        // 6️⃣ 정답 채점
        const isCorrect = dto.selectedAnswer === quiz.correctAnswer;
        const pointsEarned = isCorrect ? (quiz.points || 200) : 0;

        // 7️⃣ user_records에 모든 시도 기록 저장 (정답/오답 모두)
        const userRecord = await tx.userRecord.create({
          data: {
            userId,
            userChallengeId: activeChallenge.id,
            recordType: 'QUIZ',
            date: today,
            metadata: {
              // 챌린지 컨텍스트
              challengeMissionId: challengeMission.id,
              missionId: challengeMission.missionId,
              missionName: '퀴즈',
              missionType: 'QUIZ',
              day: challengeMission.day,
              productId: challengeMission.productId,
              productName: challengeMission.product.name,

              // 미션 진행 정보
              attemptNumber: attemptCount + 1,
              isCompleted: isCorrect,
              pointsEarned,

              // 실제 퀴즈 컨텐츠
              quizId: quiz.id,
              question: quiz.question,
              options: quiz.options,
              selectedAnswer: dto.selectedAnswer,
              correctAnswer: quiz.correctAnswer,
              isCorrect,
              explanation: quiz.explanation
            },
            createdAt: now
          }
        });

        this.logger.log(`퀴즈 시도 기록 저장 완료 - user_records ID: ${userRecord.id}, 정답: ${isCorrect}`);

        // 8️⃣ 정답일 경우 포인트 적립
        if (isCorrect) {
          await this.pointService.addPoints(
            userId,
            pointsEarned,
            getPointDescription(PointRelatedType.QUIZ),
            PointRelatedType.QUIZ,
            quiz.id
          );
        }

        const result = {
          selectedAnswer: dto.selectedAnswer,
          correctAnswer: quiz.correctAnswer,
          isCorrect,
          explanation: quiz.explanation,
          pointsEarned,
          answeredAt: now
        };

        this.logger.log(`퀴즈 완료 처리 성공 - ${quiz.question}, 정답: ${isCorrect}, 포인트: ${pointsEarned}`);
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
            date: new Date(todayStr),
            createdAt: getNowKST(),
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
          description: getPointDescription(PointRelatedType.QUIZ),
          relatedType: PointRelatedType.QUIZ,
          relatedId: activeChallenge.id,
          createdAt: getNowKST()
        }
      });

      this.logger.log(`퀴즈 챌린지 연동 성공 - ${quizTitle}, 포인트: ${pointsEarned}`);

    } catch (error) {
      this.logger.error('퀴즈 챌린지 연동 실패:', error);
      // 챌린지 연동 실패해도 퀴즈 답변은 저장됨
    }
  }

  /**
   * 오늘의 퀴즈 조회
   * @param userId 사용자 ID
   * @description quizzes 테이블에서 오늘의 퀴즈 조회
   */
  async getDailyQuizzes(userId: number) {
    try {
      this.logger.log(`오늘의 퀴즈 조회 - 사용자: ${userId}`);

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

      // 2️⃣ ChallengeMission → Mission → MissionQuiz → Quiz 순으로 오늘의 퀴즈 조회
      const challengeMission = await this.prisma.challengeMission.findFirst({
        where: {
          productId: activeChallenge.productId,
          day: currentDay,
          isActive: true,
          mission: {
            type: 'QUIZ'  // 퀴즈 타입 미션만
          }
        },
        include: {
          mission: {
            include: {
              missionQuizzes: {
                where: {
                  day: currentDay,
                  isActive: true
                },
                include: {
                  quiz: true
                },
                orderBy: {
                  sortOrder: 'asc'
                },
                take: 1  // 첫 번째 퀴즈만
              }
            }
          }
        }
      });

      // 퀴즈가 없는 경우
      const missionQuiz = challengeMission?.mission?.missionQuizzes?.[0];
      const quiz = missionQuiz?.quiz;

      if (!challengeMission || !missionQuiz || !quiz) {
        return {
          success: true,
          data: {
            currentDay,
            quiz: null,
            message: '오늘의 퀴즈가 없습니다'
          }
        };
      }

      this.logger.log(`오늘의 퀴즈 조회 완료 - ${quiz.question}`);

      return {
        success: true,
        data: {
          currentDay,
          quiz: {
            challengeMissionId: challengeMission.id,
            quizId: quiz.id,
            question: quiz.question,
            options: quiz.options,
            explanation: quiz.explanation,
            points: quiz.points
          }
        }
      };

    } catch (error) {
      this.logger.error('오늘의 퀴즈 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 강의 퀴즈 완료 처리
   * @param userId 사용자 ID
   * @param quizId 퀴즈 ID
   * @param selectedAnswer 선택한 답변 번호
   * @description 강의 연결 퀴즈를 풀고 포인트를 지급합니다
   * - 챌린저 당일 퀴즈 (currentDay === dayNumber): 200점 지급
   * - 챌린저 과거 퀴즈 (currentDay > dayNumber): 포인트 지급 안함
   * - 구독자: 퀴즈 풀이 불가 (Controller에서 차단)
   */
  async completeLectureQuiz(userId: number, quizId: number, selectedAnswer: number) {
    try {
      this.logger.log(`강의 퀴즈 완료 처리 시작 - 사용자: ${userId}, 퀴즈: ${quizId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1️⃣ 퀴즈 조회
        const quiz = await tx.quiz.findFirst({
          where: {
            id: quizId,
            isActive: true
          },
          include: {
            lectureQuizzes: {
              include: {
                content: true
              }
            }
          }
        });

        if (!quiz) {
          throw new NotFoundException('퀴즈를 찾을 수 없습니다');
        }

        // 2️⃣ 강의 연결 확인 (lectureQuizzes를 통해)
        const linkedContent = quiz.lectureQuizzes?.[0]?.content;

        if (!linkedContent) {
          throw new BadRequestException('강의와 연결되지 않은 퀴즈입니다');
        }

        // 3️⃣ 답변 번호 유효성 검증
        if (selectedAnswer < 1 || selectedAnswer > (quiz.options as any[]).length) {
          throw new BadRequestException('올바르지 않은 답변 번호입니다');
        }

        // 4️⃣ 활성 챌린지 조회 및 currentDay 계산
        const activeChallenge = await tx.userChallenge.findFirst({
          where: {
            userId,
            status: 'ACTIVE'
          }
        });

        let canEarnPoints = false;
        let pointEarnMessage = '';

        if (activeChallenge) {
          // activatedAt 기준으로 현재 챌린지 일차 계산
          const currentDay = calculateChallengeDay(activeChallenge.activatedAt);
          const lectureDayNumber = linkedContent.dayNumber;

          if (currentDay === lectureDayNumber) {
            // 당일 퀴즈: 포인트 지급 가능
            canEarnPoints = true;
            pointEarnMessage = '당일 퀴즈 완료';
            this.logger.log(`당일 퀴즈 - currentDay: ${currentDay}, lectureDayNumber: ${lectureDayNumber}, 포인트 지급 O`);
          } else if (currentDay > lectureDayNumber) {
            // 과거 퀴즈: 포인트 지급 안함
            canEarnPoints = false;
            pointEarnMessage = '과거 퀴즈는 포인트가 지급되지 않습니다';
            this.logger.log(`과거 퀴즈 - currentDay: ${currentDay}, lectureDayNumber: ${lectureDayNumber}, 포인트 지급 X`);
          } else {
            // 미래 퀴즈: 접근 불가 (여기까지 오면 안됨, Controller에서 차단되어야 함)
            throw new BadRequestException('아직 접근할 수 없는 퀴즈입니다');
          }
        } else {
          // 챌린지 미참여자 (구독자 등): 포인트 지급 안함
          canEarnPoints = false;
          pointEarnMessage = '챌린지 참여자만 포인트를 받을 수 있습니다';
          this.logger.log(`챌린지 미참여자 - 포인트 지급 X`);
        }

        // 5️⃣ 포인트 지급 여부 확인 (최초 1회만 포인트, 재시도는 허용)
        const pointsAlreadyGiven = await tx.quizAttempt.findFirst({
          where: {
            userId,
            quizId,
            pointsEarned: { gt: 0 }
          }
        });

        // 6️⃣ 정답 채점
        const isCorrect = selectedAnswer === quiz.correctAnswer;

        // 7️⃣ 포인트 계산 (정답 + 당일 퀴즈 + 최초 1회만 퀴즈 포인트 지급)
        const basePoints = quiz.points ?? 300;
        const pointsEarned = (isCorrect && canEarnPoints && !pointsAlreadyGiven) ? basePoints : 0;

        const now = getNowKST();

        // 8️⃣ 퀴즈 시도 기록 저장 (매 시도마다 기록, 재도전 허용)
        await tx.quizAttempt.create({
          data: {
            userId,
            quizId,
            contentId: linkedContent.id,
            selectedAnswer,
            isCorrect,
            pointsEarned,
            createdAt: now
          }
        });

        // 8-1️⃣ user_records에도 기록 저장 (홈 미션 진행도 반영용)
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (activeChallenge) {
          const currentDay = calculateChallengeDay(activeChallenge.activatedAt);
          await tx.userRecord.create({
            data: {
              userId,
              userChallengeId: activeChallenge.id,
              recordType: 'QUIZ',
              date: today,
              metadata: {
                // 퀴즈 정보
                quizId: quiz.id,
                question: quiz.question,
                selectedAnswer,
                correctAnswer: quiz.correctAnswer,
                isCorrect,
                // 강의 정보
                contentId: linkedContent.id,
                contentTitle: linkedContent.title,
                lectureDayNumber: linkedContent.dayNumber,
                // 챌린지 정보
                day: currentDay,
                productId: activeChallenge.productId,
                // 포인트 정보
                pointsEarned,
                canEarnPoints,
                // 완료 여부
                isCompleted: true,
              },
              createdAt: now,
            },
          });
        }

        // 9️⃣ 포인트 지급 (조건 충족 시만)
        if (pointsEarned > 0) {
          await this.pointService.addPoints(
            userId,
            pointsEarned,
            getPointDescription(PointRelatedType.QUIZ),
            PointRelatedType.QUIZ,
            quizId
          );
        }

        const result = {
          quiz: {
            id: quiz.id,
            question: quiz.question,
            explanation: quiz.explanation
          },
          content: {
            id: linkedContent.id,
            title: linkedContent.title
          },
          selectedAnswer,
          correctAnswer: quiz.correctAnswer,
          isCorrect,
          pointsEarned,
          canEarnPoints,
          pointEarnMessage: pointsEarned === 0 ? pointEarnMessage : null,
          answeredAt: now
        };

        this.logger.log(`강의 퀴즈 완료 성공 - 퀴즈: ${quiz.id}, 정답: ${isCorrect}, 포인트: ${pointsEarned}`);
        return { success: true, data: result };
      });

    } catch (error) {
      this.logger.error('강의 퀴즈 완료 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 강의 퀴즈 완료 여부 조회 (가벼운 API)
   * 홈화면의 퀴즈 상태 로직과 동일
   * @param userId 사용자 ID
   * @param lectureId 강의 ID
   * @returns { alreadyCompleted: boolean }
   */
  async getQuizStatusByLecture(userId: number, lectureId: number): Promise<{ alreadyCompleted: boolean }> {
    // 1. 강의에 연결된 퀴즈 조회
    const lecture = await this.prisma.content.findUnique({
      where: { id: lectureId },
      select: {
        lectureQuizzes: {
          where: { isActive: true },
          select: { quizId: true },
          take: 1,
        },
      },
    });

    if (!lecture?.lectureQuizzes?.[0]?.quizId) {
      // 퀴즈가 없는 강의
      return { alreadyCompleted: false };
    }

    const quizId = lecture.lectureQuizzes[0].quizId;

    // 2. quizAttempt에서 시도 여부 확인 (홈화면 로직과 동일)
    const quizAttempt = await this.prisma.quizAttempt.findFirst({
      where: {
        userId,
        quizId,
      },
      select: { id: true },
    });

    return { alreadyCompleted: !!quizAttempt };
  }
}