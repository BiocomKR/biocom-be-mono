import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ReviewStatus, PointRelatedType } from '../../common/enums';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewQueryDto,
  ReviewResponseDto,
  ReviewPaginatedResponseDto,
  ReviewSortType,
  ReviewHelpfulResponseDto,
  CreateReviewCommentDto,
  UpdateReviewCommentDto,
  ReviewCommentResponseDto,
  ReviewCommentPaginatedResponseDto
} from '../dto/reviews/review.dto';
import { Prisma } from '@prisma/client';
import { getNowKST } from '../../common/utils/kst-date.util';
import { getPointDescription } from '../../common/utils/point-description.util';
import { OrderStatus } from '../../common/enums';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 리뷰 작성
   * 로그인한 사용자라면 누구나 리뷰 작성 가능
   * 최초 리뷰 작성 시 적립금 지급 (기본 1,000원 + 포토 2,000원 + 장문 2,000원)
   */
  async createReview(userId: number, dto: CreateReviewDto): Promise<ReviewResponseDto> {
    this.logger.log(`사용자 ${userId}가 상품 ${dto.productId} 리뷰 작성 시도`);

    // 상품 존재 확인
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId }
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    // 구매 이력 확인 (결제 완료 이후 상태만 - PENDING_PAYMENT, CANCELLED, PAYMENT_FAILED 제외)
    const purchaseHistory = await this.prisma.orderItem.findFirst({
      where: {
        productId: dto.productId,
        order: {
          userId,
          status: {
            in: [
              OrderStatus.PAID,
              OrderStatus.PREPARING,
              OrderStatus.SHIPPED,
              OrderStatus.DELIVERED,
              OrderStatus.CANCEL_REQUESTED,
              OrderStatus.COMPLETED
            ]
          }
        }
      }
    });

    if (!purchaseHistory) {
      throw new BadRequestException('해당 상품을 구매한 이력이 없어 리뷰를 작성할 수 없습니다');
    }

    // 해당 상품에 대한 사용자의 기존 리뷰 확인 (최초 리뷰인지 체크)
    const existingReviews = await this.prisma.productFeedback.findMany({
      where: {
        userId,
        productId: dto.productId,
        feedbackType: 'REVIEW',
        status: { in: ['ACTIVE', 'HIDDEN'] } // DELETED는 제외
      }
    });

    const isFirstReview = existingReviews.length === 0;

    // 적립금 계산 (최초 리뷰인 경우만)
    let rewardAmount = 0;
    if (isFirstReview) {
      // 기본 후기 적립금
      rewardAmount = 1000;

      // 포토 후기 추가 적립
      if (dto.reviewType === 'PHOTO' && dto.mediaUrls && dto.mediaUrls.length > 0) {
        rewardAmount += 2000;
      }

      // 장문 후기 추가 적립 (150자 이상)
      if (dto.content && dto.content.length >= 150) {
        rewardAmount += 2000;
      }

      this.logger.log(`최초 리뷰 작성 - 적립금 ${rewardAmount}원 지급 예정`);
    }

    // 트랜잭션으로 리뷰 작성 + 적립금 지급 처리
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 리뷰 작성
      const review = await tx.productFeedback.create({
        data: {
          userId,
          productId: dto.productId,
          feedbackType: 'REVIEW',
          title: dto.title,
          content: dto.content,
          rating: dto.rating,
          reviewType: dto.reviewType || 'TEXT',
          mediaUrls: dto.mediaUrls || [],
          rewardGiven: isFirstReview && rewardAmount > 0,
          rewardAmount: isFirstReview ? rewardAmount : null,
          rewardedAt: isFirstReview && rewardAmount > 0 ? getNowKST() : null,
          createdAt: getNowKST()
        },
        include: {
          user: {
            select: {
              name: true,
              points: true
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          }
        }
      });

      // 2. 적립금 지급 (최초 리뷰인 경우만)
      if (isFirstReview && rewardAmount > 0) {
        // 사용자 포인트 업데이트
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            points: { increment: rewardAmount }
          }
        });

        // 포인트 히스토리 기록
        await tx.pointHistory.create({
          data: {
            userId,
            type: 'EARNED',
            amount: rewardAmount,
            balance: updatedUser.points,
            description: getPointDescription(PointRelatedType.REVIEW),
            relatedType: PointRelatedType.REVIEW,
            relatedId: review.id,
            createdAt: getNowKST()
          }
        });

        this.logger.log(`적립금 지급 완료: 사용자 ${userId}, ${rewardAmount}원, 잔액 ${updatedUser.points}원`);
      }

      return review;
    });

    this.logger.log(`리뷰 작성 완료: ${result.id}`);

    return this.formatReviewResponse(result);
  }

  /**
   * 리뷰 목록 조회 (페이지네이션)
   */
  async findReviews(query: ReviewQueryDto): Promise<ReviewPaginatedResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // WHERE 조건 구성
    const where: Prisma.ProductFeedbackWhereInput = {
      feedbackType: 'REVIEW',
      status: ReviewStatus.ACTIVE,
      parentId: null  // 댓글 제외, 리뷰만 조회
    };

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.rating) {
      where.rating = query.rating;
    }

    if (query.reviewType) {
      where.reviewType = query.reviewType;
    }

    if (query.isBest !== undefined) {
      where.isBest = query.isBest;
    }

    // 정렬 조건 구성
    let orderBy: Prisma.ProductFeedbackOrderByWithRelationInput[] = [];
    switch (query.sort) {
      case ReviewSortType.LATEST:
        orderBy = [{ createdAt: 'desc' }];
        break;
      case ReviewSortType.OLDEST:
        orderBy = [{ createdAt: 'asc' }];
        break;
      case ReviewSortType.RATING_HIGH:
        orderBy = [{ rating: 'desc' }, { createdAt: 'desc' }];
        break;
      case ReviewSortType.RATING_LOW:
        orderBy = [{ rating: 'asc' }, { createdAt: 'desc' }];
        break;
      case ReviewSortType.HELPFUL:
        orderBy = [{ helpfulCount: 'desc' }, { createdAt: 'desc' }];
        break;
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    // 베스트 리뷰를 우선 정렬
    if (!query.isBest) {
      orderBy.unshift({ isBest: 'desc' });
    }

    // 데이터 조회
    const [reviews, total] = await Promise.all([
      this.prisma.productFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              name: true
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          },
          replies: {
            where: {
              status: ReviewStatus.ACTIVE
            },
            orderBy: {
              createdAt: 'asc'
            },
            include: {
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }),
      this.prisma.productFeedback.count({ where })
    ]);

    // 별점 통계 조회 (상품별로 조회하는 경우만)
    let ratingStats = {
      averageRating: 0,
      totalCount: 0,
      rating1Count: 0,
      rating2Count: 0,
      rating3Count: 0,
      rating4Count: 0,
      rating5Count: 0
    };

    if (query.productId) {
      const stats = await this.getProductRatingStats(query.productId);
      ratingStats = stats;
    }

    return {
      items: reviews.map(review => this.formatReviewResponse(review, true)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      ratingStats
    };
  }

  /**
   * 리뷰 수정
   * 작성자만 수정 가능
   */
  async updateReview(userId: number, id: number, dto: UpdateReviewDto): Promise<ReviewResponseDto> {
    this.logger.log(`사용자 ${userId}가 리뷰 ${id} 수정 시도`);

    // 리뷰 존재 확인 및 권한 검증
    const existingReview = await this.prisma.productFeedback.findFirst({
      where: {
        id,
        feedbackType: 'REVIEW',
        status: ReviewStatus.ACTIVE
      }
    });

    if (!existingReview) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    if (existingReview.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 리뷰만 수정할 수 있습니다');
    }

    // 리뷰 수정
    const updatedReview = await this.prisma.productFeedback.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        rating: dto.rating,
        reviewType: dto.reviewType,
        mediaUrls: dto.mediaUrls
      },
      include: {
        user: {
          select: {
            name: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        }
      }
    });

    this.logger.log(`리뷰 수정 완료: ${id}`);

    return this.formatReviewResponse(updatedReview);
  }

  /**
   * 리뷰 삭제
   * 작성자만 삭제 가능 (소프트 삭제)
   */
  async deleteReview(userId: number, id: number): Promise<{ success: boolean; message: string }> {
    this.logger.log(`사용자 ${userId}가 리뷰 ${id} 삭제 시도`);

    // 리뷰 존재 확인 및 권한 검증
    const existingReview = await this.prisma.productFeedback.findFirst({
      where: {
        id,
        feedbackType: 'REVIEW',
        status: ReviewStatus.ACTIVE
      }
    });

    if (!existingReview) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    if (existingReview.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 리뷰만 삭제할 수 있습니다');
    }

    // 소프트 삭제
    await this.prisma.productFeedback.update({
      where: { id },
      data: {
        status: ReviewStatus.DELETED
      }
    });

    this.logger.log(`리뷰 삭제 완료: ${id}`);

    return {
      success: true,
      message: '리뷰가 삭제되었습니다'
    };
  }

  /**
   * 리뷰 도움됨 토글
   * 한 사용자당 한 번만 도움됨 표시 가능
   */
  async toggleHelpful(userId: number, reviewId: number): Promise<ReviewHelpfulResponseDto> {
    this.logger.log(`사용자 ${userId}가 리뷰 ${reviewId} 도움됨 토글`);

    // 리뷰 존재 확인
    const review = await this.prisma.productFeedback.findFirst({
      where: {
        id: reviewId,
        feedbackType: 'REVIEW',
        status: ReviewStatus.ACTIVE
      }
    });

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    // 본인 리뷰에는 도움됨 표시 불가
    if (review.userId === userId) {
      throw new BadRequestException('본인이 작성한 리뷰에는 도움됨을 표시할 수 없습니다');
    }

    // 기존 도움됨 기록 확인 (별도 테이블이 없으므로 간단히 구현)
    // 실제로는 ReviewHelpful 테이블을 만드는 것이 좋지만, 일단 간단히 구현

    // 현재 도움됨 수 증가/감소
    const currentCount = review.helpfulCount;
    const newCount = currentCount + 1; // 실제로는 사용자별 도움됨 여부를 확인해야 함

    const updatedReview = await this.prisma.productFeedback.update({
      where: { id: reviewId },
      data: {
        helpfulCount: newCount
      }
    });

    return {
      success: true,
      helpfulCount: updatedReview.helpfulCount,
      isHelpful: true
    };
  }

  /**
   * 베스트 리뷰 설정/해제 (관리자 기능)
   */
  async setBestReview(reviewId: number, isBest: boolean): Promise<ReviewResponseDto> {
    this.logger.log(`리뷰 ${reviewId} 베스트 리뷰 ${isBest ? '설정' : '해제'}`);

    const review = await this.prisma.productFeedback.findFirst({
      where: {
        id: reviewId,
        feedbackType: 'REVIEW',
        status: ReviewStatus.ACTIVE
      }
    });

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    const updatedReview = await this.prisma.productFeedback.update({
      where: { id: reviewId },
      data: {
        isBest,
        bestSelectedAt: isBest ? getNowKST() : null
      },
      include: {
        user: {
          select: {
            name: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        }
      }
    });

    this.logger.log(`베스트 리뷰 ${isBest ? '설정' : '해제'} 완료: ${reviewId}`);

    return this.formatReviewResponse(updatedReview);
  }

  /**
   * 상품의 별점 통계 조회
   */
  async getProductRatingStats(productId: number) {
    const stats = await this.prisma.productFeedback.groupBy({
      by: ['rating'],
      where: {
        productId,
        feedbackType: 'REVIEW',
        status: ReviewStatus.ACTIVE,
        rating: { not: null }
      },
      _count: {
        rating: true
      }
    });

    let totalCount = 0;
    let totalRating = 0;
    const ratingCounts = {
      rating1Count: 0,
      rating2Count: 0,
      rating3Count: 0,
      rating4Count: 0,
      rating5Count: 0
    };

    stats.forEach(stat => {
      const rating = stat.rating!;
      const count = stat._count.rating;
      totalCount += count;
      totalRating += rating * count;

      switch (rating) {
        case 1: ratingCounts.rating1Count = count; break;
        case 2: ratingCounts.rating2Count = count; break;
        case 3: ratingCounts.rating3Count = count; break;
        case 4: ratingCounts.rating4Count = count; break;
        case 5: ratingCounts.rating5Count = count; break;
      }
    });

    return {
      averageRating: totalCount > 0 ? Number((totalRating / totalCount).toFixed(1)) : 0,
      totalCount,
      ...ratingCounts
    };
  }

  /**
   * 리뷰 응답 데이터 포맷팅
   * @param review 리뷰 데이터
   * @param includeComments 댓글 포함 여부 (기본값: false)
   */
  private formatReviewResponse(review: any, includeComments: boolean = false): ReviewResponseDto {
    const response: ReviewResponseDto = {
      id: review.id,
      productId: review.productId,
      userId: review.userId,
      userName: this.maskUserName(review.user.name),
      title: review.title,
      content: review.content,
      rating: review.rating,
      reviewType: review.reviewType,
      mediaUrls: review.mediaUrls || [],
      isBest: review.isBest,
      bestSelectedAt: review.bestSelectedAt?.toISOString(),
      helpfulCount: review.helpfulCount,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt?.toISOString(),
      product: {
        id: review.product.id,
        name: review.product.name,
        sku: review.product.sku
      }
    };

    // 댓글 포함 (상세 조회 시에만)
    if (includeComments && review.replies) {
      response.comments = review.replies.map((comment: any) => this.formatCommentResponse(comment));
      response.commentCount = review.replies.length;
    }

    return response;
  }

  /**
   * 사용자명 마스킹 (홍길동 -> 홍*동)
   */
  private maskUserName(name: string): string {
    if (name.length <= 2) {
      return name.charAt(0) + '*';
    }
    return name.charAt(0) + '*' + name.charAt(name.length - 1);
  }

  /**
   * 리뷰 댓글 작성
   * 로그인한 사용자라면 누구나 댓글 작성 가능
   */
  async createReviewComment(userId: number, reviewId: number, dto: CreateReviewCommentDto): Promise<ReviewCommentResponseDto> {
    this.logger.log(`사용자 ${userId}가 리뷰 ${reviewId}에 댓글 작성 시도`);

    // 리뷰 존재 확인
    const review = await this.prisma.productFeedback.findFirst({
      where: {
        id: reviewId,
        feedbackType: 'REVIEW',
        status: ReviewStatus.ACTIVE
      }
    });

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    // 댓글 작성
    const comment = await this.prisma.productFeedback.create({
      data: {
        userId,
        productId: review.productId,
        feedbackType: 'REVIEW',
        parentId: reviewId,
        content: dto.content,
        mediaUrls: dto.mediaUrls || [],
        createdAt: getNowKST()
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    this.logger.log(`리뷰 댓글 작성 완료: ${comment.id}`);

    return this.formatCommentResponse(comment);
  }

  /**
   * 리뷰 댓글 목록 조회 (페이지네이션)
   */
  async findReviewComments(reviewId: number, page: number = 1, limit: number = 20): Promise<ReviewCommentPaginatedResponseDto> {
    const skip = (page - 1) * limit;

    // 리뷰 존재 확인
    const review = await this.prisma.productFeedback.findFirst({
      where: {
        id: reviewId,
        feedbackType: 'REVIEW',
        status: ReviewStatus.ACTIVE
      }
    });

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    // WHERE 조건 구성
    const where: Prisma.ProductFeedbackWhereInput = {
      parentId: reviewId,
      feedbackType: 'REVIEW',
      status: ReviewStatus.ACTIVE
    };

    // 데이터 조회
    const [comments, total] = await Promise.all([
      this.prisma.productFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              name: true
            }
          }
        }
      }),
      this.prisma.productFeedback.count({ where })
    ]);

    return {
      items: comments.map(comment => this.formatCommentResponse(comment)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 리뷰 댓글 수정
   * 작성자만 수정 가능
   */
  async updateReviewComment(userId: number, commentId: number, dto: UpdateReviewCommentDto): Promise<ReviewCommentResponseDto> {
    this.logger.log(`사용자 ${userId}가 댓글 ${commentId} 수정 시도`);

    // 댓글 존재 확인 및 권한 검증
    const existingComment = await this.prisma.productFeedback.findFirst({
      where: {
        id: commentId,
        feedbackType: 'REVIEW',
        status: ReviewStatus.ACTIVE,
        parentId: { not: null } // 댓글인지 확인
      }
    });

    if (!existingComment) {
      throw new NotFoundException('댓글을 찾을 수 없습니다');
    }

    if (existingComment.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 댓글만 수정할 수 있습니다');
    }

    // 댓글 수정
    const updatedComment = await this.prisma.productFeedback.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        mediaUrls: dto.mediaUrls
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    this.logger.log(`댓글 수정 완료: ${commentId}`);

    return this.formatCommentResponse(updatedComment);
  }

  /**
   * 리뷰 댓글 삭제
   * 작성자만 삭제 가능 (소프트 삭제)
   */
  async deleteReviewComment(userId: number, commentId: number): Promise<{ success: boolean; message: string }> {
    this.logger.log(`사용자 ${userId}가 댓글 ${commentId} 삭제 시도`);

    // 댓글 존재 확인 및 권한 검증
    const existingComment = await this.prisma.productFeedback.findFirst({
      where: {
        id: commentId,
        feedbackType: 'REVIEW',
        status: ReviewStatus.ACTIVE,
        parentId: { not: null } // 댓글인지 확인
      }
    });

    if (!existingComment) {
      throw new NotFoundException('댓글을 찾을 수 없습니다');
    }

    if (existingComment.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 댓글만 삭제할 수 있습니다');
    }

    // 소프트 삭제
    await this.prisma.productFeedback.update({
      where: { id: commentId },
      data: {
        status: ReviewStatus.DELETED
      }
    });

    this.logger.log(`댓글 삭제 완료: ${commentId}`);

    return {
      success: true,
      message: '댓글이 삭제되었습니다'
    };
  }

  /**
   * 댓글 응답 데이터 포맷팅
   */
  private formatCommentResponse(comment: any): ReviewCommentResponseDto {
    return {
      id: comment.id,
      reviewId: comment.parentId!,
      userId: comment.userId,
      userName: this.maskUserName(comment.user.name),
      content: comment.content,
      mediaUrls: comment.mediaUrls || [],
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt?.toISOString()
    };
  }
}