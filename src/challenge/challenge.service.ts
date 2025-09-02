import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Logger } from '@nestjs/common';

/**
 * 챌린지 서비스
 * 챌린지 관련 비즈니스 로직을 처리합니다
 */
@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 구매 가능한 챌린지 목록 조회
   * @description 상품과 연결된 활성 챌린지들을 조회합니다
   */
  async getAvailableChallenges() {
    try {
      this.logger.log('구매 가능한 챌린지 목록 조회 시작');

      const challenges = await this.prisma.challenge.findMany({
        where: {
          isActive: true,
          challengeProducts: {
            some: {
              isActive: true,
              product: {
                status: 'ACTIVE'
              }
            }
          }
        },
        include: {
          challengeProducts: {
            where: { isActive: true },
            include: {
              product: {
                include: {
                  options: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const result = challenges.map(challenge => ({
        id: challenge.id,
        name: challenge.name,
        description: challenge.description,
        totalDays: challenge.totalDays,
        isActive: challenge.isActive,
        products: challenge.challengeProducts.map(cp => ({
          id: cp.product.id,
          name: cp.product.name,
          price: cp.product.options[0]?.price || 0
        }))
      }));

      this.logger.log(`구매 가능한 챌린지 ${result.length}개 조회 완료`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('구매 가능한 챌린지 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자의 챌린지 수행권 조회
   * @param userId 사용자 ID
   */
  async getMyTickets(userId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 챌린지 수행권 조회 시작`);

      const tickets = await this.prisma.challengeTicket.findMany({
        where: { userId },
        include: {
          challenge: true
        },
        orderBy: { purchaseDate: 'desc' }
      });

      const result = tickets.map(ticket => ({
        id: ticket.id,
        challenge: {
          id: ticket.challenge.id,
          name: ticket.challenge.name,
          description: ticket.challenge.description,
          totalDays: ticket.challenge.totalDays,
          isActive: ticket.challenge.isActive
        },
        purchaseDate: ticket.purchaseDate,
        status: ticket.status
      }));

      this.logger.log(`사용자 ${userId}의 챌린지 수행권 ${result.length}개 조회 완료`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('챌린지 수행권 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자의 현재 활성 챌린지 조회 + 오늘의 활동 통합
   * @param userId 사용자 ID
   */
  async getMyActiveChallenge(userId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 활성 챌린지 + 오늘 활동 조회 시작`);

      const activeChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: 'ACTIVE'
        },
        include: {
          challenge: true,
          ticket: true
        }
      });

      if (!activeChallenge) {
        this.logger.log(`사용자 ${userId}의 활성 챌린지 없음`);
        return { success: true, data: null };
      }

      const challengeId = activeChallenge.challengeId;
      const currentDay = activeChallenge.currentDay;
      const weekNumber = Math.ceil(currentDay / 7);

      // 오늘의 미션 조회
      const missions = await this.prisma.challengeMission.findMany({
        where: {
          challengeId,
          day: currentDay,
          isActive: true
        },
        include: { mission: true },
        orderBy: { sortOrder: 'asc' }
      });

      // 오늘의 설문 조회
      const surveys = await this.prisma.challengeSurvey.findMany({
        where: {
          challengeId,
          day: currentDay,
          isActive: true
        },
        include: { 
          survey: {
            include: {
              surveyQuestions: {
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        }
      });

      // 오늘의 퀴즈 조회
      const quizzes = await this.prisma.challengeQuiz.findMany({
        where: {
          challengeId,
          day: currentDay,
          isActive: true
        },
        include: { quiz: true },
        orderBy: { sortOrder: 'asc' }
      });

      // 이번 주 컨텐츠 조회
      const contents = await this.prisma.challengeContent.findMany({
        where: {
          challengeId,
          weekNumber,
          isActive: true
        },
        include: { 
          content: {
            include: {
              contentFiles: true
            }
          }
        }
      });

      // 기록 항목 조회
      const recordItems = await this.prisma.recordItem.findMany({
        orderBy: { id: 'asc' }
      });

      // 오늘의 기록 현황 조회
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const todayRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          date: new Date(todayStr)
        }
      });

      const result = {
        // 기본 챌린지 정보
        id: activeChallenge.id,
        challenge: {
          id: activeChallenge.challenge.id,
          name: activeChallenge.challenge.name,
          description: activeChallenge.challenge.description,
          totalDays: activeChallenge.challenge.totalDays,
          isActive: activeChallenge.challenge.isActive
        },
        activatedAt: activeChallenge.activatedAt,
        expiresAt: activeChallenge.expiresAt,
        currentDay: activeChallenge.currentDay,
        totalPoints: activeChallenge.totalPoints,
        status: activeChallenge.status,
        
        // 오늘의 활동 (통합)
        todayActivities: {
          currentDay,
          todayDate: today,
          missions: missions.map(cm => ({
            id: cm.id,
            mission: cm.mission,
            points: cm.points,
            sortOrder: cm.sortOrder
          })),
          surveys: surveys.map(cs => ({
            id: cs.id,
            survey: cs.survey
          })),
          quizzes: quizzes.map(cq => ({
            id: cq.id,
            quiz: cq.quiz,
            sortOrder: cq.sortOrder
          })),
          contents: contents.map(cc => ({
            id: cc.id,
            content: cc.content,
            weekNumber: cc.weekNumber
          })),
          records: recordItems.map(item => {
            const todayRecord = todayRecords.find(r => r.recordCode === item.code);
            return {
              ...item,
              isCompleted: !!todayRecord,
              todayValue: todayRecord?.value || null,
              recordedAt: todayRecord?.createdAt || null
            };
          })
        }
      };

      this.logger.log(`사용자 ${userId}의 활성 챌린지 + 오늘 활동 조회 완료: ${activeChallenge.challenge.name} (${currentDay}일차)`);
      this.logger.log(`- 미션 ${missions.length}개, 설문 ${surveys.length}개, 퀴즈 ${quizzes.length}개, 컨텐츠 ${contents.length}개`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('활성 챌린지 + 오늘 활동 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 챌린지 활성화 (수행권 사용)
   * @param userId 사용자 ID
   * @param ticketId 수행권 ID
   */
  async activateChallenge(userId: number, ticketId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 챌린지 활성화 시작 - 수행권 ${ticketId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1. 이미 활성 챌린지가 있는지 확인
        const existingActive = await tx.userChallenge.findFirst({
          where: { userId, status: 'ACTIVE' }
        });

        if (existingActive) {
          throw new ConflictException('이미 활성화된 챌린지가 있습니다');
        }

        // 2. 수행권 확인
        const ticket = await tx.challengeTicket.findFirst({
          where: {
            id: ticketId,
            userId,
            status: 'PURCHASED'
          },
          include: { challenge: true }
        });

        if (!ticket) {
          throw new NotFoundException('사용 가능한 수행권을 찾을 수 없습니다');
        }

        if (!ticket.challenge.isActive) {
          throw new BadRequestException('비활성화된 챌린지입니다');
        }

        // 3. 챌린지 활성화
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ticket.challenge.totalDays * 24 * 60 * 60 * 1000);

        const userChallenge = await tx.userChallenge.create({
          data: {
            userId,
            challengeId: ticket.challengeId,
            ticketId,
            activatedAt: now,
            expiresAt,
            currentDay: 1,
            status: 'ACTIVE'
          },
          include: { challenge: true }
        });

        // 4. 수행권 상태 변경
        await tx.challengeTicket.update({
          where: { id: ticketId },
          data: { status: 'ACTIVATED' }
        });

        // 5. 첫날(Day 1) 진행 상황 생성
        await tx.dailyProgress.create({
          data: {
            userChallengeId: userChallenge.id,
            day: 1,
            date: new Date(now.getFullYear(), now.getMonth(), now.getDate())
          }
        });

        const result = {
          userChallengeId: userChallenge.id,
          challengeName: ticket.challenge.name,
          activatedAt: userChallenge.activatedAt,
          expiresAt: userChallenge.expiresAt,
          totalDays: ticket.challenge.totalDays,
          currentDay: 1
        };

        this.logger.log(`사용자 ${userId}의 챌린지 활성화 완료: ${ticket.challenge.name}`);
        return { success: true, data: result };
      });
    } catch (error) {
      this.logger.error('챌린지 활성화 실패:', error);
      throw error;
    }
  }

  /**
   * 챌린지 진행 상황 조회
   * @param userId 사용자 ID
   * @param challengeId 챌린지 ID
   */
  async getChallengeProgress(userId: number, challengeId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 챌린지 ${challengeId} 진행 상황 조회 시작`);

      const userChallenge = await this.prisma.userChallenge.findFirst({
        where: { userId, challengeId },
        include: {
          challenge: true,
          dailyProgress: {
            orderBy: { day: 'asc' }
          }
        }
      });

      if (!userChallenge) {
        throw new NotFoundException('해당 챌린지를 찾을 수 없습니다');
      }

      const progressData = userChallenge.dailyProgress.map(progress => ({
        day: progress.day,
        date: progress.date,
        missions: {
          total: progress.missionsTotal,
          completed: progress.missionsCompleted
        },
        surveys: {
          total: progress.surveysTotal,
          completed: progress.surveysCompleted
        },
        quizzes: {
          total: progress.quizzesTotal,
          correct: progress.quizzesCorrect
        },
        contents: {
          total: progress.contentsTotal,
          viewed: progress.contentsViewed
        },
        records: {
          total: progress.recordsTotal,
          completed: progress.recordsCompleted
        },
        pointsEarned: progress.pointsEarned
      }));

      const result = {
        challenge: {
          id: userChallenge.challenge.id,
          name: userChallenge.challenge.name,
          totalDays: userChallenge.challenge.totalDays
        },
        activatedAt: userChallenge.activatedAt,
        currentDay: userChallenge.currentDay,
        totalPoints: userChallenge.totalPoints,
        status: userChallenge.status,
        progress: progressData
      };

      this.logger.log(`챌린지 진행 상황 조회 완료 - ${progressData.length}일차 데이터`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('챌린지 진행 상황 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 오늘의 챌린지 활동 조회
   * @param userId 사용자 ID
   * @param challengeId 챌린지 ID
   */
  async getTodayActivities(userId: number, challengeId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 오늘 활동 조회 시작 - 챌린지 ${challengeId}`);

      const userChallenge = await this.prisma.userChallenge.findFirst({
        where: { userId, challengeId, status: 'ACTIVE' },
        include: { challenge: true }
      });

      if (!userChallenge) {
        throw new NotFoundException('활성화된 챌린지를 찾을 수 없습니다');
      }

      const currentDay = userChallenge.currentDay;
      const weekNumber = Math.ceil(currentDay / 7);

      // 오늘의 미션 조회
      const missions = await this.prisma.challengeMission.findMany({
        where: {
          challengeId,
          day: currentDay,
          isActive: true
        },
        include: { mission: true },
        orderBy: { sortOrder: 'asc' }
      });

      // 오늘의 설문 조회
      const surveys = await this.prisma.challengeSurvey.findMany({
        where: {
          challengeId,
          day: currentDay,
          isActive: true
        },
        include: { survey: true }
      });

      // 오늘의 퀴즈 조회
      const quizzes = await this.prisma.challengeQuiz.findMany({
        where: {
          challengeId,
          day: currentDay,
          isActive: true
        },
        include: { quiz: true },
        orderBy: { sortOrder: 'asc' }
      });

      // 이번 주 컨텐츠 조회
      const contents = await this.prisma.challengeContent.findMany({
        where: {
          challengeId,
          weekNumber,
          isActive: true
        },
        include: { content: true }
      });

      // 기록 항목 조회
      const recordItems = await this.prisma.recordItem.findMany({
        orderBy: { id: 'asc' }
      });

      const result = {
        currentDay,
        todayDate: new Date(),
        missions: missions.map(cm => ({
          id: cm.id,
          mission: cm.mission,
          points: cm.points
        })),
        surveys: surveys.map(cs => ({
          id: cs.id,
          survey: cs.survey
        })),
        quizzes: quizzes.map(cq => ({
          id: cq.id,
          quiz: cq.quiz
        })),
        contents: contents.map(cc => ({
          id: cc.id,
          content: cc.content
        })),
        records: recordItems
      };

      this.logger.log(`오늘의 활동 조회 완료 - 미션 ${missions.length}개, 설문 ${surveys.length}개, 퀴즈 ${quizzes.length}개, 컨텐츠 ${contents.length}개`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('오늘의 활동 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 챌린지 완료 리포트 조회
   * @param userId 사용자 ID
   * @param challengeId 챌린지 ID
   */
  async getChallengeReport(userId: number, challengeId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 챌린지 ${challengeId} 리포트 조회 시작`);

      const userChallenge = await this.prisma.userChallenge.findFirst({
        where: { userId, challengeId },
        include: {
          challenge: true,
          dailyProgress: true
        }
      });

      if (!userChallenge) {
        throw new NotFoundException('해당 챌린지를 찾을 수 없습니다');
      }

      if (userChallenge.status !== 'COMPLETED') {
        throw new BadRequestException('완료되지 않은 챌린지입니다');
      }

      // 통계 계산
      const totalDays = userChallenge.dailyProgress.length;
      const totalMissions = userChallenge.dailyProgress.reduce((sum, p) => sum + p.missionsTotal, 0);
      const completedMissions = userChallenge.dailyProgress.reduce((sum, p) => sum + p.missionsCompleted, 0);
      const totalPoints = userChallenge.totalPoints;

      const result = {
        challenge: {
          id: userChallenge.challenge.id,
          name: userChallenge.challenge.name,
          totalDays: userChallenge.challenge.totalDays
        },
        summary: {
          completedDays: totalDays,
          totalMissions,
          completedMissions,
          completionRate: totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0,
          totalPoints
        },
        activatedAt: userChallenge.activatedAt,
        completedAt: userChallenge.updatedAt
      };

      this.logger.log(`챌린지 리포트 조회 완료 - 완주률 ${result.summary.completionRate}%`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('챌린지 리포트 조회 실패:', error);
      throw error;
    }
  }

  // ==================== 백오피스 관리용 메서드들 ====================

  /**
   * 모든 챌린지 조회 (백오피스용)
   */
  async findAllChallenges(options: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }) {
    const { page, limit, status, search } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [challenges, total] = await Promise.all([
      this.prisma.challenge.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              userChallenges: true,
              challengeMissions: true,
              challengeSurveys: true,
              challengeQuizzes: true,
              challengeContents: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.challenge.count({ where })
    ]);

    return {
      challenges,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 특정 챌린지 상세 조회 (백오피스용)
   */
  async findChallengeById(id: number) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id },
      include: {
        challengeMissions: {
          include: { mission: true },
          orderBy: { day: 'asc' }
        },
        challengeSurveys: {
          include: { survey: true },
          orderBy: { day: 'asc' }
        },
        challengeQuizzes: {
          include: { quiz: true },
          orderBy: { day: 'asc' }
        },
        challengeContents: {
          include: { content: true },
          orderBy: { day: 'asc' }
        },
        _count: {
          select: { userChallenges: true }
        }
      }
    });

    if (!challenge) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    return challenge;
  }

  /**
   * 새 챌린지 생성 (백오피스용)
   */
  async createChallenge(data: {
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    maxParticipants?: number;
    entryFee?: number;
    isActive?: boolean;
  }) {
    return await this.prisma.challenge.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive ?? true
      }
    });
  }

  /**
   * 챌린지 수정 (백오피스용)
   */
  async updateChallenge(id: number, data: {
    name?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    totalDays?: number;
    maxParticipants?: number;
    entryFee?: number;
    isActive?: boolean;
  }) {
    const updateData: any = { ...data };
    
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    return await this.prisma.challenge.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * 챌린지 삭제 (백오피스용)
   */
  async deleteChallenge(id: number) {
    // 참여자가 있는지 확인
    const participantCount = await this.prisma.userChallenge.count({
      where: { challengeId: id }
    });

    if (participantCount > 0) {
      throw new BadRequestException('참여자가 있는 챌린지는 삭제할 수 없습니다');
    }

    // 관련 데이터 삭제
    await this.prisma.$transaction(async (tx) => {
      await tx.challengeMission.deleteMany({ where: { challengeId: id } });
      await tx.challengeSurvey.deleteMany({ where: { challengeId: id } });
      await tx.challengeQuiz.deleteMany({ where: { challengeId: id } });
      await tx.challengeContent.deleteMany({ where: { challengeId: id } });
      await tx.challengeProduct.deleteMany({ where: { challengeId: id } });
      await tx.challenge.delete({ where: { id } });
    });
  }

  /**
   * 챌린지 참여자 목록 조회 (백오피스용)
   */
  async getChallengeParticipants(options: {
    challengeId: number;
    page: number;
    limit: number;
    status?: string;
  }) {
    const { challengeId, page, limit, status } = options;
    const skip = (page - 1) * limit;

    const where: any = { challengeId };
    if (status) where.status = status;

    const [participants, total] = await Promise.all([
      this.prisma.userChallenge.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, name: true, points: true }
          },
          challenge: {
            select: { id: true, name: true }
          },
          _count: {
            select: { dailyProgress: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.userChallenge.count({ where })
    ]);

    return {
      participants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 챌린지에 미션 추가 (백오피스용)
   */
  async addMissionToChallenge(challengeId: number, data: {
    missionId: number;
    day: number;
    requiredCount?: number;
    points?: number;
    isActive?: boolean;
  }) {
    return await this.prisma.challengeMission.create({
      data: {
        challengeId,
        missionId: data.missionId,
        day: data.day,
        requiredCount: data.requiredCount || 1,
        points: data.points || 50,
        isActive: data.isActive ?? true
      },
      include: {
        mission: true
      }
    });
  }

  /**
   * 챌린지에 설문 추가 (백오피스용)
   */
  async addSurveyToChallenge(challengeId: number, data: {
    surveyId: number;
    day: number;
    points?: number;
    isActive?: boolean;
  }) {
    return await this.prisma.challengeSurvey.create({
      data: {
        challengeId,
        surveyId: data.surveyId,
        day: data.day,
        points: data.points || 50,
        isActive: data.isActive ?? true
      },
      include: {
        survey: true
      }
    });
  }

  /**
   * 챌린지에 퀴즈 추가 (백오피스용)
   */
  async addQuizToChallenge(challengeId: number, data: {
    quizId: number;
    day: number;
    points?: number;
    isActive?: boolean;
  }) {
    return await this.prisma.challengeQuiz.create({
      data: {
        challengeId,
        quizId: data.quizId,
        day: data.day,
        points: data.points || 50,
        isActive: data.isActive ?? true
      },
      include: {
        quiz: true
      }
    });
  }

  /**
   * 챌린지에 컨텐츠 추가 (백오피스용)
   */
  async addContentToChallenge(challengeId: number, data: {
    contentId: number;
    day: number;
    points?: number;
    isActive?: boolean;
  }) {
    return await this.prisma.challengeContent.create({
      data: {
        challengeId,
        contentId: data.contentId,
        day: data.day,
        points: data.points || 50,
        isActive: data.isActive ?? true
      },
      include: {
        content: true
      }
    });
  }

  /**
   * 챌린지 통계 조회 (백오피스용)
   */
  async getChallengeStats(challengeId: number) {
    const [
      challenge,
      totalParticipants,
      activeParticipants,
      completedParticipants,
      totalMissions,
      totalSurveys,
      totalQuizzes,
      totalContents
    ] = await Promise.all([
      this.prisma.challenge.findUnique({ where: { id: challengeId } }),
      this.prisma.userChallenge.count({ where: { challengeId } }),
      this.prisma.userChallenge.count({ where: { challengeId, status: 'ACTIVE' } }),
      this.prisma.userChallenge.count({ where: { challengeId, status: 'COMPLETED' } }),
      this.prisma.challengeMission.count({ where: { challengeId, isActive: true } }),
      this.prisma.challengeSurvey.count({ where: { challengeId, isActive: true } }),
      this.prisma.challengeQuiz.count({ where: { challengeId, isActive: true } }),
      this.prisma.challengeContent.count({ where: { challengeId, isActive: true } })
    ]);

    if (!challenge) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    return {
      challenge,
      stats: {
        participants: {
          total: totalParticipants,
          active: activeParticipants,
          completed: completedParticipants,
          dropped: totalParticipants - activeParticipants - completedParticipants,
          completionRate: totalParticipants > 0 ? Math.round((completedParticipants / totalParticipants) * 100) : 0
        },
        content: {
          missions: totalMissions,
          surveys: totalSurveys,
          quizzes: totalQuizzes,
          contents: totalContents,
          total: totalMissions + totalSurveys + totalQuizzes + totalContents
        }
      }
    };
  }

  /**
   * 챌린지 활성/비활성 전환 (백오피스용)
   */
  async toggleChallengeStatus(challengeId: number) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    return await this.prisma.challenge.update({
      where: { id: challengeId },
      data: { isActive: !challenge.isActive }
    });
  }

  /**
   * 챌린지 설문 전후 비교 조회
   * @param userId 사용자 ID
   * @param challengeId 챌린지 ID
   */
  async getChallengeSurveyComparison(userId: number, challengeId: number) {
    this.logger.log(`챌린지 설문 전후 비교 조회 - 사용자: ${userId}, 챌린지: ${challengeId}`);

    const result = await this.prisma.userChallengeSurveyResult.findUnique({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
    });

    if (!result) {
      throw new NotFoundException('챌린지 설문 결과를 찾을 수 없습니다.');
    }

    // Before 동물 캐릭터 정보
    const beforeCategoryDetail = result.beforeCategory 
      ? await this.prisma.categoryDetail.findFirst({
          where: { categoryCode: result.beforeCategory },
        })
      : null;

    // After 동물 캐릭터 정보
    const afterCategoryDetail = result.afterCategory
      ? await this.prisma.categoryDetail.findFirst({
          where: { categoryCode: result.afterCategory },
        })
      : null;

    return {
      success: true,
      data: {
        userId,
        challengeId,
        before: {
          category: result.beforeCategory,
          animalCharacter: beforeCategoryDetail?.animalCharacter,
          characterKeyword: beforeCategoryDetail?.characterKeyword,
          detailedFeatures: beforeCategoryDetail?.detailedFeatures,
          scores: {
            skinHealth: result.beforeSkinHealthScore,
            metabolism: result.beforeMetabolismScore,
            immune: result.beforeImmuneScore,
            gutHealth: result.beforeGutHealthScore,
          },
          completedAt: result.beforeCompletedAt,
        },
        after: result.afterCategory ? {
          category: result.afterCategory,
          animalCharacter: afterCategoryDetail?.animalCharacter,
          characterKeyword: afterCategoryDetail?.characterKeyword,
          detailedFeatures: afterCategoryDetail?.detailedFeatures,
          scores: {
            skinHealth: result.afterSkinHealthScore,
            metabolism: result.afterMetabolismScore,
            immune: result.afterImmuneScore,
            gutHealth: result.afterGutHealthScore,
          },
          completedAt: result.afterCompletedAt,
        } : null,
        scoreComparison: {
          skinHealth: {
            before: result.beforeSkinHealthScore || 0,
            after: result.afterSkinHealthScore || 0,
            change: (result.afterSkinHealthScore || 0) - (result.beforeSkinHealthScore || 0),
            improvement: result.beforeSkinHealthScore 
              ? Math.round(((result.afterSkinHealthScore || 0) - result.beforeSkinHealthScore) / result.beforeSkinHealthScore * 100 * 100) / 100 
              : 0
          },
          metabolism: {
            before: result.beforeMetabolismScore || 0,
            after: result.afterMetabolismScore || 0,
            change: (result.afterMetabolismScore || 0) - (result.beforeMetabolismScore || 0),
            improvement: result.beforeMetabolismScore 
              ? Math.round(((result.afterMetabolismScore || 0) - result.beforeMetabolismScore) / result.beforeMetabolismScore * 100 * 100) / 100
              : 0
          },
          immune: {
            before: result.beforeImmuneScore || 0,
            after: result.afterImmuneScore || 0,
            change: (result.afterImmuneScore || 0) - (result.beforeImmuneScore || 0),
            improvement: result.beforeImmuneScore 
              ? Math.round(((result.afterImmuneScore || 0) - result.beforeImmuneScore) / result.beforeImmuneScore * 100 * 100) / 100
              : 0
          },
          gutHealth: {
            before: result.beforeGutHealthScore || 0,
            after: result.afterGutHealthScore || 0,
            change: (result.afterGutHealthScore || 0) - (result.beforeGutHealthScore || 0),
            improvement: result.beforeGutHealthScore 
              ? Math.round(((result.afterGutHealthScore || 0) - result.beforeGutHealthScore) / result.beforeGutHealthScore * 100 * 100) / 100
              : 0
          }
        }
      },
      timestamp: new Date()
    };
  }

}