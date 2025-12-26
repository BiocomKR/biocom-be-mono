import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserChallengeStatus, UserSubscriptionStatus } from '../common/enums';
import { PointService } from '../point/point.service';
import { PaginationHelper, PaginatedResult } from '../common/utils/pagination.util';
import { CreateContentDto, UpdateContentDto, ContentFileDto } from './content.types';
import * as DOMPurify from 'isomorphic-dompurify';
import { getNowKST } from '../common/utils/kst-date.util';

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
          createdAt: getNowKST(),
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
   * 컨텐츠 상세 조회 (구버전 - deprecated)
   * @deprecated GET /api/contents/columns/:id 또는 /api/contents/lectures/:id 사용 권장
   */
  async getContentById(id: number): Promise<any> {
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        contentFiles: {
          include: {
            file: true
          },
          orderBy: { sortOrder: 'asc' },
        },
        challenge: {
          select: {
            id: true,
            name: true,
            metadata: true,
          },
        },
      },
    });

    if (!content) {
      throw new NotFoundException(`컨텐츠를 찾을 수 없습니다: ${id}`);
    }

    // 칼럼인 경우 이전글/다음글 추가
    if (content.type === 'COLUMN') {
      // 이전글 (현재 글보다 ID가 작은 것 중 가장 큰 ID)
      const prevContent = await this.prisma.content.findFirst({
        where: {
          type: 'COLUMN',
          isActive: true,
          id: { lt: id }
        },
        orderBy: { id: 'desc' },
        select: { id: true, title: true }
      });

      // 다음글 (현재 글보다 ID가 큰 것 중 가장 작은 ID)
      const nextContent = await this.prisma.content.findFirst({
        where: {
          type: 'COLUMN',
          isActive: true,
          id: { gt: id }
        },
        orderBy: { id: 'asc' },
        select: { id: true, title: true }
      });

      return {
        ...content,
        prevContent: prevContent || null,
        nextContent: nextContent || null
      };
    }

    return content;
  }

  /**
   * 칼럼 상세 조회 (이전글/다음글 포함)
   */
  async getColumnById(id: number): Promise<any> {
    this.logger.log(`칼럼 상세 조회 - ID: ${id}`);

    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        contentFiles: {
          include: {
            file: true
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!content) {
      throw new NotFoundException(`칼럼을 찾을 수 없습니다: ${id}`);
    }

    if (content.type !== 'COLUMN') {
      throw new BadRequestException(`해당 컨텐츠는 칼럼이 아닙니다: ${id}`);
    }

    // 이전글 (현재 글보다 ID가 작은 것 중 가장 큰 ID)
    const prevContent = await this.prisma.content.findFirst({
      where: {
        type: 'COLUMN',
        isActive: true,
        id: { lt: id }
      },
      orderBy: { id: 'desc' },
      select: { id: true, title: true }
    });

    // 다음글 (현재 글보다 ID가 큰 것 중 가장 작은 ID)
    const nextContent = await this.prisma.content.findFirst({
      where: {
        type: 'COLUMN',
        isActive: true,
        id: { gt: id }
      },
      orderBy: { id: 'asc' },
      select: { id: true, title: true }
    });

    this.logger.log(`칼럼 상세 조회 완료 - ID: ${id}`);

    return {
      ...content,
      prevContent: prevContent || null,
      nextContent: nextContent || null
    };
  }

  /**
   * 강의 상세 조회 (퀴즈 포함)
   */
  async getLectureById(id: number): Promise<any> {
    this.logger.log(`강의 상세 조회 - ID: ${id}`);

    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        contentFiles: {
          include: {
            file: true
          },
          orderBy: { sortOrder: 'asc' },
        },
        // 연결된 퀴즈들
        lectureQuizzes: {
          include: {
            quiz: true
          },
          orderBy: { sortOrder: 'asc' }
        },
        // 연결된 상품들
        lectureProducts: {
          include: {
            product: {
              include: {
                images: true
              }
            }
          },
          orderBy: { sortOrder: 'asc' }
        },
        challenge: {
          select: {
            id: true,
            name: true,
            metadata: true,
          },
        },
      },
    });

    if (!content) {
      throw new NotFoundException(`강의를 찾을 수 없습니다: ${id}`);
    }

    if (content.type !== 'LECTURE') {
      throw new BadRequestException(`해당 컨텐츠는 강의가 아닙니다: ${id}`);
    }

    // 같은 주차의 다른 강의 목록 조회 (플레이리스트)
    this.logger.log(`플레이리스트 조회 조건 - weekNumber: ${content.weekNumber}, challengeId: ${content.challengeId}`);

    const playlist = await this.prisma.content.findMany({
      where: {
        type: 'LECTURE',
        isActive: true,
        weekNumber: content.weekNumber,
        challengeId: content.challengeId,
      },
      select: {
        id: true,
        title: true,
        dayNumber: true,
        weekNumber: true,
        contentFiles: {
          where: {
            file: {
              mimeType: {
                startsWith: 'image/'
              }
            }
          },
          include: {
            file: true
          },
          orderBy: { sortOrder: 'asc' },
          take: 1, // 썸네일 1개만
        },
      },
      orderBy: { dayNumber: 'asc' },
    });

    this.logger.log(`강의 상세 조회 완료 - ID: ${id}, 플레이리스트: ${playlist.length}개, 조회된 ID들: ${playlist.map(p => p.id).join(', ')}`);

    return {
      ...content,
      playlist,
    };
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
    const content = await this.prisma.content.findUnique({
      where: { id },
      select: { challengeId: true },
    });

    if (content?.challengeId) {
      throw new BadRequestException(
        `챌린지에서 사용 중인 컨텐츠는 삭제할 수 없습니다. (챌린지 ID: ${content.challengeId})`
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
            include: {
              file: true
            },
            orderBy: { sortOrder: 'asc' },
          },
          _count: {
            select: {
              contentFiles: true,
              quizAttempts: true,
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
   * 조회수 증가 (중복 허용)
   * @param contentId 컨텐츠 ID
   * @param userId 사용자 ID (선택사항, 사용 안함)
   * @deprecated userId 파라미터는 더 이상 사용되지 않음 (중복 방지 제거됨)
   */
  async increaseViewCount(contentId: number, userId?: number): Promise<void> {
    this.logger.log(`컨텐츠 조회수 증가 - 컨텐츠: ${contentId}`);

    try {
      // 단순 조회수 증가 (중복 허용)
      await this.prisma.content.update({
        where: { id: contentId },
        data: { viewCount: { increment: 1 } }
      });

      this.logger.log(`컨텐츠 조회수 증가 완료 - 컨텐츠: ${contentId}`);

    } catch (error) {
      this.logger.error('컨텐츠 조회수 증가 실패:', error);
      // 조회수 증가 실패해도 메인 로직에 영향 주지 않도록 에러를 throw하지 않음
    }
  }

  /**
   * 컨텐츠 시청 완료 처리
   * @deprecated 2025-10-28 - 포인트 지급은 퀴즈 풀이로 이동
   * @param userId 사용자 ID
   * @param contentId 컨텐츠 ID
   */
  async completeContent(userId: number, contentId: number) {
    throw new BadRequestException('이 API는 더 이상 사용되지 않습니다. 퀴즈 풀이 API를 사용하세요.');
    /*
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
            status: UserChallengeStatus.ACTIVE
          },
          include: { product: true }
        });

        let challengeInfo = null;
        let pointsEarned = 0;

        if (activeChallenge) {
          const metadata = activeChallenge.product.metadata as any;
          challengeInfo = {
            productId: activeChallenge.productId,
            challengeName: metadata?.challengeName || activeChallenge.product.name,
            currentDay: activeChallenge.currentDay
          };

          // 4️⃣ 최초 시청인 경우에만 포인트 지급
          if (isFirstView) {
            // 컨텐츠 기본 포인트 (예: 50포인트)
            pointsEarned = content.points || 50;

            // DailyProgress 조회/생성
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
              viewedAt: getNowKST()
            }
          });
        }

        const result = {
          content: {
            id: content.id,
            title: content.title,
            type: content.type
          },
          viewedAt: getNowKST(),
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
    */
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
          include: {
            file: true
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            contentFiles: true,
            quizAttempts: true,
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
              quizAttempts: true,
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
   * 강의 목록 조회 (주차별)
   * @param userId 사용자 ID
   * @param week 주차 (1,2,3)
   * @param challengeId 챌린지 ID (옵션)
   */
  async getLectures(userId: number, week?: number, challengeId?: number): Promise<any> {
    this.logger.log(`강의 목록 조회 - 사용자: ${userId}, 주차: ${week}, 챌린지: ${challengeId}`);

    try {
      // 1️⃣ 사용자 구독 상태 확인
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true }
      });

      const isSubscriber = user?.status === UserSubscriptionStatus.SUBSCRIBER;

      // 2️⃣ 챌린저인 경우 주차 접근 권한 검증
      if (!isSubscriber && week) {
        // 활성 챌린지 조회
        const activeChallenge = await this.prisma.userChallenge.findFirst({
          where: {
            userId,
            status: UserChallengeStatus.ACTIVE
          },
          select: { activatedAt: true }
        });

        if (activeChallenge) {
          // 챌린지 일차 계산 (calculateChallengeDay 사용)
          const { calculateChallengeDay } = await import('../common/utils/kst-date.util');
          const currentDay = calculateChallengeDay(activeChallenge.activatedAt);

          // 접근 가능한 주차 계산 (1~7일: 1주차, 8~14일: 2주차, 15~21일: 3주차)
          const allowedWeek = Math.ceil(currentDay / 7);

          this.logger.log(`챌린저 주차 검증 - 현재 ${currentDay}일차, 요청 ${week}주차, 허용 ${allowedWeek}주차`);

          // 요청한 주차가 허용 범위 초과면 빈 배열 반환
          if (week > allowedWeek) {
            this.logger.log(`챌린저 접근 제한 - ${week}주차 조회 불가 (현재 ${currentDay}일차)`);
            return [];
          }
        }
      }

      // 3️⃣ 챌린지 상품 ID 확정 (없으면 기본 챌린지 조회)
      let finalChallengeId = challengeId;

      if (!finalChallengeId) {
        const defaultChallenge = await this.prisma.product.findFirst({
          where: {
            categoryCode: 'CHALLENGE',
            status: UserChallengeStatus.ACTIVE
          },
          select: { id: true },
          orderBy: { id: 'asc' }
        });

        if (!defaultChallenge) {
          throw new NotFoundException('활성화된 챌린지 상품이 없습니다');
        }

        finalChallengeId = defaultChallenge.id;
        this.logger.log(`기본 챌린지 상품 사용 - productId: ${finalChallengeId}`);
      }

      // 4️⃣ WHERE 조건
      const where: any = {
        type: 'LECTURE',
        isActive: true,
        challengeId: finalChallengeId
      };

      // 주차 필터가 있으면 추가
      if (week) {
        where.weekNumber = week;
      }

      this.logger.log(`강의 조회 조건 - 챌린지: ${finalChallengeId}, 주차: ${week || '전체'}`);

      // 4️⃣ 강의 목록 조회
      const lectures = await this.prisma.content.findMany({
        where,
        include: {
          contentFiles: {
            include: {
              file: true
            },
            orderBy: { sortOrder: 'asc' }
          },
          // 연결된 퀴즈들
          lectureQuizzes: {
            include: {
              quiz: true
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
              contentFiles: true,
              quizAttempts: true,
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

      this.logger.log(`강의 목록 조회 완료 - 총 ${lectures.length}개`);

      return lectures;

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
              include: {
                file: true
              },
              orderBy: { sortOrder: 'asc' }
            },
            _count: {
              select: {
                contentFiles: true,
                quizAttempts: true,
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
            include: {
              file: true
            },
            orderBy: { sortOrder: 'asc' }
          },
          _count: {
            select: {
              contentFiles: true,
              quizAttempts: true,
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

}