import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { PointService } from '../point/point.service';
import { PaginationHelper, PaginatedResult } from '../common/utils/pagination.util';
import { CreateContentDto, UpdateContentDto, ContentFileDto } from './content.types';
import * as DOMPurify from 'isomorphic-dompurify';

/**
 * 컨텐츠 관리 서비스
 */
@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService,
  ) {}

  /**
   * HTML 컨텐츠 sanitize
   * XSS 공격 방지를 위한 HTML 정제
   */
  private sanitizeHtml(html: string): string {
    // 허용할 태그와 속성 설정
    const config = {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'a', 'ul', 'ol', 'li', 'img', 'div', 'span',
        'table', 'thead', 'tbody', 'tr', 'td', 'th'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'width', 'height', 'style',
        'class', 'id', 'target', 'rel'
      ],
      ALLOWED_SCHEMES: ['http', 'https', 'mailto'],
      ALLOW_DATA_ATTR: false
    };

    return DOMPurify.sanitize(html, config);
  }

  /**
   * 컨텐츠 생성
   */
  async createContent(data: CreateContentDto, files?: ContentFileDto[]): Promise<any> {
    this.logger.log(`컨텐츠 생성 - 제목: ${data.title}`);

    // HTML 컨텐츠 sanitize
    const sanitizedContent = this.sanitizeHtml(data.content);

    const content = await this.prisma.$transaction(async (tx) => {
      // 컨텐츠 생성
      const newContent = await tx.content.create({
        data: {
          title: data.title,
          content: sanitizedContent,
          type: data.type,
          isActive: data.isActive ?? true,
        },
      });

      // 첨부파일이 있으면 저장
      if (files && files.length > 0) {
        await tx.contentFile.createMany({
          data: files.map((file, index) => ({
            contentId: newContent.id,
            fileUrl: file.fileUrl,
            fileName: file.fileName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            sortOrder: file.sortOrder ?? index,
          })),
        });
      }

      return newContent;
    });

    this.logger.log(`컨텐츠 생성 완료 - ID: ${content.id}`);
    return this.getContentById(content.id);
  }

  /**
   * 컨텐츠 상세 조회
   */
  async getContentById(id: number): Promise<any> {
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        contentFiles: {
          orderBy: { sortOrder: 'asc' },
        },
        challengeContents: {
          include: {
            challenge: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
    });

    if (!content) {
      throw new NotFoundException(`컨텐츠를 찾을 수 없습니다: ${id}`);
    }

    return content;
  }

  /**
   * 컨텐츠 수정
   */
  async updateContent(
    id: number,
    data: UpdateContentDto,
    files?: ContentFileDto[]
  ): Promise<any> {
    this.logger.log(`컨텐츠 수정 - ID: ${id}`);

    // 존재 확인
    await this.getContentById(id);

    // HTML 컨텐츠 sanitize
    if (data.content) {
      data.content = this.sanitizeHtml(data.content);
    }

    const content = await this.prisma.$transaction(async (tx) => {
      // 컨텐츠 업데이트
      const updated = await tx.content.update({
        where: { id },
        data,
      });

      // 새로운 파일이 있으면 기존 파일 삭제 후 새로 저장
      if (files && files.length > 0) {
        await tx.contentFile.deleteMany({
          where: { contentId: id },
        });

        await tx.contentFile.createMany({
          data: files.map((file, index) => ({
            contentId: id,
            fileUrl: file.fileUrl,
            fileName: file.fileName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            sortOrder: file.sortOrder ?? index,
          })),
        });
      }

      return updated;
    });

    this.logger.log(`컨텐츠 수정 완료 - ID: ${id}`);
    return this.getContentById(id);
  }

  /**
   * 컨텐츠 삭제
   */
  async deleteContent(id: number): Promise<void> {
    this.logger.log(`컨텐츠 삭제 - ID: ${id}`);

    // 챌린지와 연결된 컨텐츠인지 확인
    const challengeContentCount = await this.prisma.challengeContent.count({
      where: { contentId: id },
    });

    if (challengeContentCount > 0) {
      throw new BadRequestException(
        `챌린지에서 사용 중인 컨텐츠는 삭제할 수 없습니다. (연결된 챌린지 수: ${challengeContentCount})`
      );
    }

    await this.prisma.content.delete({
      where: { id },
    });

    this.logger.log(`컨텐츠 삭제 완료 - ID: ${id}`);
  }

  /**
   * 컨텐츠 목록 조회 (사용자용)
   */
  async getContentList(params: {
    page: number;
    limit: number;
    type?: string;
    category?: string;
    search?: string;
    isActive?: boolean;
  }): Promise<PaginatedResult<any>> {
    this.logger.log(`컨텐츠 목록 조회 - page: ${params.page}, limit: ${params.limit}`);

    const where: any = {};

    // 검색어 필터
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { content: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // 타입 필터
    if (params.type) {
      where.type = params.type;
    }

    // 카테고리 필터 (메타데이터에서 필터링)
    if (params.category) {
      where.metadata = {
        path: '$.category',
        equals: params.category,
      };
    }

    // 활성화 상태 필터
    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    // 페이징 처리
    const result = await PaginationHelper.paginate<any>(
      this.prisma.content,
      { page: params.page, limit: params.limit },
      {
        where,
        include: {
          contentFiles: {
            orderBy: { sortOrder: 'asc' },
          },
          _count: {
            select: {
              challengeContents: true,
            },
          },
        },
      },
      { sortBy: 'createdAt', sortOrder: 'desc' }
    );

    this.logger.log(`컨텐츠 목록 조회 완료 - 총 ${result.total}개`);

    return result;
  }

  /**
   * 조회수 증가 (사용자별 중복 방지)
   * @param contentId 컨텐츠 ID
   * @param userId 사용자 ID (선택사항, 로그인하지 않은 경우 null)
   */
  async increaseViewCount(contentId: number, userId?: number): Promise<void> {
    this.logger.log(`컨텐츠 조회수 증가 요청 - 컨텐츠: ${contentId}, 사용자: ${userId}`);

    try {
      // 오늘 날짜 (YYYY-MM-DD 형식)
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // 1️⃣ 로그인된 사용자인 경우 중복 방지 체크
      if (userId) {
        const existingView = await this.prisma.contentView.findFirst({
          where: {
            userId,
            contentId,
            viewedAt: {
              gte: new Date(todayStr), // 오늘 00:00:00부터
              lt: new Date(new Date(todayStr).getTime() + 24 * 60 * 60 * 1000) // 내일 00:00:00 전까지
            }
          }
        });

        // 이미 오늘 조회한 적이 있으면 조회수 증가하지 않음
        if (existingView) {
          this.logger.log(`이미 오늘 조회한 컨텐츠 - 컨텐츠: ${contentId}, 사용자: ${userId}`);
          return;
        }
      }

      await this.prisma.$transaction(async (tx) => {
        // 2️⃣ 컨텐츠 조회수 증가
        await tx.content.update({
          where: { id: contentId },
          data: { viewCount: { increment: 1 } }
        });

        // 3️⃣ 로그인된 사용자인 경우 조회 기록 생성
        if (userId) {
          await tx.contentView.create({
            data: {
              userId,
              contentId,
              viewedAt: new Date()
            }
          });
        }
      });

      this.logger.log(`컨텐츠 조회수 증가 완료 - 컨텐츠: ${contentId}`);

    } catch (error) {
      this.logger.error('컨텐츠 조회수 증가 실패:', error);
      // 조회수 증가 실패해도 메인 로직에 영향 주지 않도록 에러를 throw하지 않음
    }
  }

  /**
   * 컨텐츠 시청 완료 처리
   * @param userId 사용자 ID
   * @param contentId 컨텐츠 ID
   */
  async completeContent(userId: number, contentId: number) {
    try {
      this.logger.log(`컨텐츠 시청 완료 처리 시작 - 사용자: ${userId}, 컨텐츠: ${contentId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1️⃣ 컨텐츠 조회
        const content = await tx.content.findFirst({
          where: { 
            id: contentId,
            isActive: true
          }
        });

        if (!content) {
          throw new NotFoundException('컨텐츠를 찾을 수 없습니다');
        }

        // 2️⃣ 이미 시청했는지 확인 (최초 시청 여부 판단)
        const existingView = await tx.contentView.findFirst({
          where: {
            userId,
            contentId
          }
        });

        const isFirstView = !existingView;

        // 3️⃣ 활성 챌린지 조회
        const activeChallenge = await tx.userChallenge.findFirst({
          where: {
            userId,
            status: 'ACTIVE'
          },
          include: { challenge: true }
        });

        let challengeInfo = null;
        let pointsEarned = 0;

        if (activeChallenge) {
          challengeInfo = {
            challengeId: activeChallenge.challengeId,
            challengeName: activeChallenge.challenge.name,
            currentDay: activeChallenge.currentDay
          };

          // 4️⃣ 최초 시청인 경우에만 포인트 지급
          if (isFirstView) {
            // 컨텐츠 기본 포인트 (예: 50포인트)
            pointsEarned = content.points || 50;

            // DailyProgress 조회/생성
            const today = new Date();
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

            // DailyProgress 업데이트 (컨텐츠 시청)
            await tx.dailyProgress.update({
              where: {
                userChallengeId_day: {
                  userChallengeId: activeChallenge.id,
                  day: activeChallenge.currentDay
                }
              },
              data: {
                contentsViewed: { increment: 1 },
                pointsEarned: { increment: pointsEarned }
              }
            });

            // 사용자 총 포인트 업데이트
            await tx.userChallenge.update({
              where: { id: activeChallenge.id },
              data: {
                totalPoints: { increment: pointsEarned }
              }
            });

            // 공통 포인트 지급 서비스 사용
            await this.pointService.awardPointsInTransaction(
              tx,
              userId,
              pointsEarned,
              `컨텐츠 시청: ${content.title}`,
              'CONTENT',
              contentId
            );

            this.logger.log(`최초 시청 보상 지급 - ${content.title}, 획득 포인트: ${pointsEarned}`);
          } else {
            this.logger.log(`이미 시청한 컨텐츠 - ${content.title}, 보상 없음`);
          }
        }

        // 5️⃣ 시청 기록 생성 (이미 있으면 스킵)
        if (isFirstView) {
          await tx.contentView.create({
            data: {
              userId,
              contentId,
              userChallengeId: activeChallenge?.id || null,
              viewedAt: new Date()
            }
          });
        }

        const result = {
          content: {
            id: content.id,
            title: content.title,
            type: content.type
          },
          viewedAt: new Date(),
          isFirstView,
          pointsEarned: isFirstView ? pointsEarned : undefined,
          challengeInfo
        };

        this.logger.log(`컨텐츠 시청 완료 처리 성공 - ${content.title} (최초: ${isFirstView})`);
        return { success: true, data: result };
      });

    } catch (error) {
      this.logger.error('컨텐츠 시청 완료 처리 실패:', error);
      throw error;
    }
  }


  /**
   * 인기 컨텐츠 조회
   * 조회수 기준으로 인기 컨텐츠를 반환
   */
  async getPopularContents(limit: number): Promise<any[]> {
    const contents = await this.prisma.content.findMany({
      where: { isActive: true },
      orderBy: [
        { viewCount: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      include: {
        contentFiles: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            challengeContents: true,
            contentViews: true,
          },
        },
      },
    });

    return contents;
  }

  /**
   * 페이징 처리된 컨텐츠 목록 조회
   */
  async getContentsWithPagination(
    page: number,
    limit: number,
    filters: {
      search?: string;
      type?: string;
      isActive?: boolean;
    },
    sort: {
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ): Promise<PaginatedResult<any>> {
    this.logger.log(`페이징 처리된 컨텐츠 목록 조회 - page: ${page}, limit: ${limit}`);

    // WHERE 조건 구성
    const where: any = {};

    // 검색어 필터
    if (filters.search) {
      const searchCondition = PaginationHelper.createSearchCondition(
        filters.search,
        ['title', 'content']
      );
      if (searchCondition) {
        Object.assign(where, searchCondition);
      }
    }

    // 타입 필터
    if (filters.type) {
      where.type = filters.type;
    }

    // 활성화 상태 필터
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // 페이징 처리
    const result = await PaginationHelper.paginate<any>(
      this.prisma.content,
      { page, limit },
      {
        where,
        include: {
          _count: {
            select: {
              contentFiles: true,
              challengeContents: true,
            },
          },
        },
      },
      sort
    );

    this.logger.log(`페이징 처리된 컨텐츠 목록 조회 완료 - 총 ${result.total}개`);

    return result;
  }

  /**
   * 강의 목록 조회 (주차별, 사용자 상태별)
   * @param userId 사용자 ID
   * @param week 주차 (1,2,3)
   * @param challengeId 챌린지 ID (옵션)
   */
  async getLectures(userId: number, week?: number, challengeId?: number): Promise<any> {
    this.logger.log(`강의 목록 조회 - 사용자: ${userId}, 주차: ${week}, 챌린지: ${challengeId}`);

    try {
      // 1️⃣ 사용자 상태 조회 (챌린지/구독 상태)
      const userStatus = await this.getUserStatus(userId);

      // 2️⃣ 기본 WHERE 조건
      const where: any = {
        type: 'LECTURE',
        isActive: true
      };

      // 주차 필터가 있으면 추가
      if (week) {
        where.weekNumber = week;
      }

      // 챌린지 ID 필터가 있으면 추가
      if (challengeId) {
        where.challengeContents = {
          some: {
            challengeId: challengeId
          }
        };
      }

      // 3️⃣ 강의 목록 조회
      const lectures = await this.prisma.content.findMany({
        where,
        include: {
          contentFiles: {
            orderBy: { sortOrder: 'asc' }
          },
          // 연결된 퀴즈들
          lectureQuizzes: {
            include: {
              quiz: {
                include: {
                  contentFiles: {
                    orderBy: { sortOrder: 'asc' }
                  }
                }
              }
            },
            orderBy: { sortOrder: 'asc' }
          },
          // 연결된 상품들
          lectureProducts: {
            include: {
              product: true
            },
            orderBy: { sortOrder: 'asc' }
          },
          _count: {
            select: {
              contentViews: {
                where: { userId }
              }
            }
          }
        },
        orderBy: [
          { weekNumber: 'asc' },
          { dayNumber: 'asc' },
          { sortOrder: 'asc' },
          { createdAt: 'asc' }
        ]
      });

      // 4️⃣ 사용자 상태에 따른 필터링 적용
      const filteredLectures = await this.filterLecturesByUserStatus(lectures, userStatus);

      this.logger.log(`강의 목록 조회 완료 - 총 ${filteredLectures.length}개`);

      return {
        lectures: filteredLectures,
        userStatus,
        totalCount: filteredLectures.length
      };

    } catch (error) {
      this.logger.error('강의 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 칼럼 목록 조회 (검색, 정렬, 페이징)
   */
  async getColumns(params: {
    page: number;
    limit: number;
    search?: string;
    sort?: 'popular' | 'latest';
  }): Promise<any> {
    this.logger.log(`칼럼 목록 조회 - 페이지: ${params.page}, 검색: ${params.search}, 정렬: ${params.sort}`);

    try {
      // WHERE 조건
      const where: any = {
        type: 'COLUMN',
        isActive: true
      };

      // 검색어 필터
      if (params.search) {
        where.OR = [
          { title: { contains: params.search, mode: 'insensitive' } },
          { content: { contains: params.search, mode: 'insensitive' } }
        ];
      }

      // 정렬 조건 설정
      let orderBy: any = { createdAt: 'desc' }; // 기본값: 최신순

      if (params.sort === 'popular') {
        // 인기순: 조회수 높은 순 → 최신순
        orderBy = [
          { viewCount: 'desc' },
          { createdAt: 'desc' }
        ];
      }

      // 페이징 처리
      const result = await PaginationHelper.paginate<any>(
        this.prisma.content,
        { page: params.page, limit: params.limit },
        {
          where,
          include: {
            contentFiles: {
              orderBy: { sortOrder: 'asc' }
            },
            _count: {
              select: {
                contentViews: true
              }
            }
          },
          orderBy
        }
      );

      this.logger.log(`칼럼 목록 조회 완료 - 총 ${result.total}개`);

      return result;

    } catch (error) {
      this.logger.error('칼럼 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 오늘의 칼럼 조회 (최신 5개)
   */
  async getTodayColumns(): Promise<any[]> {
    this.logger.log('오늘의 칼럼 조회 - 최신 5개');

    try {
      const columns = await this.prisma.content.findMany({
        where: {
          type: 'COLUMN',
          isActive: true
        },
        include: {
          contentFiles: {
            orderBy: { sortOrder: 'asc' }
          },
          _count: {
            select: {
              contentViews: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      this.logger.log(`오늘의 칼럼 조회 완료 - ${columns.length}개`);

      return columns;

    } catch (error) {
      this.logger.error('오늘의 칼럼 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 상태 조회 (챌린지/구독 여부)
   * @private
   */
  private async getUserStatus(userId: number): Promise<any> {
    try {
      // 활성 챌린지 조회
      const activeChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: 'ACTIVE'
        },
        include: {
          challenge: true
        }
      });

      // 구독 상태 조회 (TODO: 구독 모델 추가 후 활성화)
      // const subscription = await this.prisma.userSubscription.findFirst({
      //   where: {
      //     userId,
      //     status: 'ACTIVE',
      //     endDate: {
      //       gte: new Date()
      //     }
      //   }
      // });
      const subscription = null; // 임시로 null 처리

      return {
        isInChallenge: !!activeChallenge,
        isSubscribed: !!subscription,
        challengeInfo: activeChallenge ? {
          id: activeChallenge.challengeId,
          name: activeChallenge.challenge.name,
          currentDay: activeChallenge.currentDay,
          startDate: activeChallenge.challenge.startDate,
          endDate: activeChallenge.challenge.endDate
        } : null,
        subscriptionInfo: subscription ? {
          id: subscription.id,
          startDate: subscription.startDate,
          endDate: subscription.endDate
        } : null
      };

    } catch (error) {
      this.logger.error('사용자 상태 조회 실패:', error);
      // 에러 발생 시 기본값 반환
      return {
        isInChallenge: false,
        isSubscribed: false,
        challengeInfo: null,
        subscriptionInfo: null
      };
    }
  }

  /**
   * 사용자 상태에 따른 강의 필터링
   * @private
   */
  private async filterLecturesByUserStatus(lectures: any[], userStatus: any): Promise<any[]> {
    return lectures.map(lecture => {
      // 기본적으로 강의는 모두 노출
      const result = {
        ...lecture,
        isViewable: true,
        quizzes: [],
        products: lecture.lectureProducts?.map((lp: any) => lp.product) || []
      };

      // 연결된 퀴즈 필터링
      if (lecture.lectureQuizzes && lecture.lectureQuizzes.length > 0) {
        result.quizzes = lecture.lectureQuizzes.map((lq: any) => {
          const quiz = { ...lq.quiz };

          if (userStatus.isInChallenge && !userStatus.isSubscribed) {
            // 챌린지만 참여 중: 현재 일차까지만 퀴즈 노출
            const currentDay = userStatus.challengeInfo?.currentDay || 1;
            quiz.isAccessible = (quiz.dayNumber || 1) <= currentDay;
            quiz.canEarnPoints = true; // 챌린지 참여자는 포인트 획득 가능
          } else if (userStatus.isSubscribed) {
            // 구독자: 모든 퀴즈 접근 가능
            quiz.isAccessible = true;
            quiz.canEarnPoints = !userStatus.isInChallenge; // 챌린지 미참여 구독자만 포인트 획득
          } else {
            // 일반 사용자: 퀴즈 접근 불가
            quiz.isAccessible = false;
            quiz.canEarnPoints = false;
          }

          return quiz;
        });
      }

      return result;
    });
  }
}