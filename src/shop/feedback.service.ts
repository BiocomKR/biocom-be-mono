/**
 * 상품 리뷰/문의 관리 서비스 (관리자용)
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Prisma } from '@prisma/client';
import { getNowKST } from '../common/utils/kst-date.util';
import {
  FeedbackType,
  FeedbackStatus,
  ReviewType,
  QuestionType,
  FeedbackSortBy,
} from './dto/feedback.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 리뷰/문의 통계 조회
   */
  async getStats() {
    // 단일 쿼리로 모든 통계 집계 (N+1 방지)
    const stats: {
      total_reviews: bigint;
      best_reviews: bigint;
      photo_reviews: bigint;
      total_questions: bigint;
      answered_questions: bigint;
      avg_rating: number | null;
    }[] = await this.prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE feedback_type = 'REVIEW' AND parent_id IS NULL AND status != 'DELETED') as total_reviews,
        COUNT(*) FILTER (WHERE feedback_type = 'REVIEW' AND parent_id IS NULL AND is_best = true AND status = 'ACTIVE') as best_reviews,
        COUNT(*) FILTER (WHERE feedback_type = 'REVIEW' AND parent_id IS NULL AND review_type = 'PHOTO' AND status != 'DELETED') as photo_reviews,
        COUNT(*) FILTER (WHERE feedback_type = 'QUESTION' AND parent_id IS NULL AND status != 'DELETED') as total_questions,
        COUNT(*) FILTER (WHERE feedback_type = 'QUESTION' AND parent_id IS NULL AND has_answer = true AND status != 'DELETED') as answered_questions,
        AVG(rating) FILTER (WHERE feedback_type = 'REVIEW' AND parent_id IS NULL AND status = 'ACTIVE') as avg_rating
      FROM product_feedback
    `;

    const result = stats[0];
    return {
      reviews: {
        total: Number(result.total_reviews),
        best: Number(result.best_reviews),
        photo: Number(result.photo_reviews),
        avgRating: result.avg_rating ? Math.round(result.avg_rating * 10) / 10 : 0,
      },
      questions: {
        total: Number(result.total_questions),
        answered: Number(result.answered_questions),
        unanswered: Number(result.total_questions) - Number(result.answered_questions),
      },
    };
  }

  /**
   * 리뷰 목록 조회 (관리자)
   */
  async getReviews(params: {
    search?: string;
    status?: FeedbackStatus;
    rating?: number;
    reviewType?: ReviewType;
    isBest?: boolean;
    sortBy?: FeedbackSortBy;
    sortOrder?: 'asc' | 'desc';
    page: number;
    limit: number;
  }) {
    const { search, status, rating, reviewType, isBest, sortBy, sortOrder, page, limit } = params;
    const skip = (page - 1) * limit;

    // WHERE 조건 구성
    const where: Prisma.ProductFeedbackWhereInput = {
      feedbackType: FeedbackType.REVIEW,
      parentId: null, // 원글만 (댓글 제외)
    };

    if (status) {
      where.status = status;
    } else {
      // 기본: DELETED 제외
      where.status = { not: FeedbackStatus.DELETED };
    }

    if (rating) where.rating = rating;
    if (reviewType) where.reviewType = reviewType;
    if (isBest !== undefined) where.isBest = isBest;

    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // 정렬 설정
    let orderBy: Prisma.ProductFeedbackOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy) {
      const order = sortOrder || 'desc';
      switch (sortBy) {
        case FeedbackSortBy.CREATED_AT:
          orderBy = { createdAt: order };
          break;
        case FeedbackSortBy.RATING:
          orderBy = { rating: order };
          break;
        case FeedbackSortBy.HELPFUL_COUNT:
          orderBy = { helpfulCount: order };
          break;
      }
    }

    const [reviews, total] = await Promise.all([
      this.prisma.productFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          product: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.productFeedback.count({ where }),
    ]);

    return {
      items: reviews.map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.product.name,
        userId: r.userId,
        userName: r.user.name,
        rating: r.rating,
        reviewType: r.reviewType,
        title: r.title,
        content: r.content,
        mediaUrls: r.mediaUrls,
        isBest: r.isBest,
        bestSelectedAt: r.bestSelectedAt,
        helpfulCount: r.helpfulCount,
        status: r.status,
        hiddenReason: r.hiddenReason,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 문의 목록 조회 (관리자)
   */
  async getQuestions(params: {
    search?: string;
    status?: FeedbackStatus;
    questionType?: QuestionType;
    hasAnswer?: boolean;
    sortBy?: FeedbackSortBy;
    sortOrder?: 'asc' | 'desc';
    page: number;
    limit: number;
  }) {
    const { search, status, questionType, hasAnswer, sortBy, sortOrder, page, limit } = params;
    const skip = (page - 1) * limit;

    // WHERE 조건 구성
    const where: Prisma.ProductFeedbackWhereInput = {
      feedbackType: FeedbackType.QUESTION,
      parentId: null, // 원글만 (답변 제외)
    };

    if (status) {
      where.status = status;
    } else {
      where.status = { not: FeedbackStatus.DELETED };
    }

    if (questionType) where.questionType = questionType;
    if (hasAnswer !== undefined) where.hasAnswer = hasAnswer;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // 정렬 설정
    let orderBy: Prisma.ProductFeedbackOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy) {
      const order = sortOrder || 'desc';
      switch (sortBy) {
        case FeedbackSortBy.CREATED_AT:
          orderBy = { createdAt: order };
          break;
      }
    }

    const [questions, total] = await Promise.all([
      this.prisma.productFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          product: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, name: true },
          },
          // 답변 조회 (parentId로 연결된 답변)
          replies: {
            where: { status: FeedbackStatus.ACTIVE },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              user: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      this.prisma.productFeedback.count({ where }),
    ]);

    return {
      items: questions.map((q) => {
        const answer = q.replies[0];
        return {
          id: q.id,
          productId: q.productId,
          productName: q.product.name,
          userId: q.userId,
          userName: q.user.name,
          questionType: q.questionType,
          title: q.title,
          content: q.content,
          isSecret: q.isSecret,
          hasAnswer: q.hasAnswer,
          status: q.status,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
          // 답변 정보
          answer: answer
            ? {
                id: answer.id,
                content: answer.content,
                answeredBy: answer.user.name,
                answeredAt: answer.createdAt,
              }
            : null,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 리뷰 상세 조회
   */
  async getReviewById(id: number) {
    const review = await this.prisma.productFeedback.findFirst({
      where: {
        id,
        feedbackType: FeedbackType.REVIEW,
        parentId: null,
      },
      include: {
        product: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true },
        },
        replies: {
          where: { status: { not: FeedbackStatus.DELETED } },
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    return {
      id: review.id,
      productId: review.productId,
      productName: review.product.name,
      userId: review.userId,
      userName: review.user.name,
      rating: review.rating,
      reviewType: review.reviewType,
      title: review.title,
      content: review.content,
      mediaUrls: review.mediaUrls,
      isBest: review.isBest,
      bestSelectedAt: review.bestSelectedAt,
      helpfulCount: review.helpfulCount,
      status: review.status,
      hiddenReason: review.hiddenReason,
      rewardAmount: review.rewardAmount,
      rewardGiven: review.rewardGiven,
      rewardedAt: review.rewardedAt,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      // 댓글 목록
      replies: review.replies.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.name,
        content: r.content,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * 문의 상세 조회
   */
  async getQuestionById(id: number) {
    const question = await this.prisma.productFeedback.findFirst({
      where: {
        id,
        feedbackType: FeedbackType.QUESTION,
        parentId: null,
      },
      include: {
        product: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true },
        },
        replies: {
          where: { status: FeedbackStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('문의를 찾을 수 없습니다');
    }

    const answer = question.replies[0];

    return {
      id: question.id,
      productId: question.productId,
      productName: question.product.name,
      userId: question.userId,
      userName: question.user.name,
      questionType: question.questionType,
      title: question.title,
      content: question.content,
      isSecret: question.isSecret,
      hasAnswer: question.hasAnswer,
      answeredBy: question.answeredBy,
      answeredAt: question.answeredAt,
      status: question.status,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      // 답변 정보
      answer: answer
        ? {
            id: answer.id,
            content: answer.content,
            answeredBy: answer.user.name,
            answeredAt: answer.createdAt,
          }
        : null,
    };
  }

  /**
   * 베스트 리뷰 선정/해제
   */
  async toggleBestReview(id: number) {
    const review = await this.prisma.productFeedback.findFirst({
      where: {
        id,
        feedbackType: FeedbackType.REVIEW,
        parentId: null,
        status: FeedbackStatus.ACTIVE,
      },
    });

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    const newIsBest = !review.isBest;

    await this.prisma.productFeedback.update({
      where: { id },
      data: {
        isBest: newIsBest,
        bestSelectedAt: newIsBest ? getNowKST() : null,
      },
    });

    this.logger.log(`베스트 리뷰 ${newIsBest ? '선정' : '해제'}: ID ${id}`);

    return {
      success: true,
      isBest: newIsBest,
    };
  }

  /**
   * 리뷰 숨김 처리
   */
  async hideReview(id: number, hiddenReason: string) {
    const review = await this.prisma.productFeedback.findFirst({
      where: {
        id,
        feedbackType: FeedbackType.REVIEW,
        parentId: null,
      },
    });

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    await this.prisma.productFeedback.update({
      where: { id },
      data: {
        status: FeedbackStatus.HIDDEN,
        hiddenReason,
        isBest: false, // 숨김 처리 시 베스트 해제
        bestSelectedAt: null,
      },
    });

    this.logger.log(`리뷰 숨김 처리: ID ${id}, 사유: ${hiddenReason}`);

    return { success: true };
  }

  /**
   * 리뷰 복원 (숨김 해제)
   */
  async restoreReview(id: number) {
    const review = await this.prisma.productFeedback.findFirst({
      where: {
        id,
        feedbackType: FeedbackType.REVIEW,
        parentId: null,
        status: FeedbackStatus.HIDDEN,
      },
    });

    if (!review) {
      throw new NotFoundException('숨김 상태의 리뷰를 찾을 수 없습니다');
    }

    await this.prisma.productFeedback.update({
      where: { id },
      data: {
        status: FeedbackStatus.ACTIVE,
        hiddenReason: null,
      },
    });

    this.logger.log(`리뷰 복원: ID ${id}`);

    return { success: true };
  }

  /**
   * 문의 답변 작성
   */
  async answerQuestion(questionId: number, content: string, operatorId: number) {
    const question = await this.prisma.productFeedback.findFirst({
      where: {
        id: questionId,
        feedbackType: FeedbackType.QUESTION,
        parentId: null,
      },
    });

    if (!question) {
      throw new NotFoundException('문의를 찾을 수 없습니다');
    }

    const now = getNowKST();

    // 트랜잭션으로 답변 생성 + 원글 업데이트
    await this.prisma.$transaction(async (tx) => {
      // 1. 답변 생성 (parent_id로 연결)
      await tx.productFeedback.create({
        data: {
          productId: question.productId,
          userId: operatorId, // 관리자 ID
          feedbackType: FeedbackType.QUESTION, // 문의에 대한 답변
          parentId: questionId,
          content,
          status: FeedbackStatus.ACTIVE,
          createdAt: now,
        },
      });

      // 2. 원글 업데이트
      await tx.productFeedback.update({
        where: { id: questionId },
        data: {
          hasAnswer: true,
          answeredBy: operatorId,
          answeredAt: now,
        },
      });
    });

    this.logger.log(`문의 답변 작성: 문의 ID ${questionId}, 관리자 ID ${operatorId}`);

    return { success: true };
  }

  /**
   * 문의 답변 수정
   */
  async updateAnswer(questionId: number, content: string, operatorId: number) {
    const question = await this.prisma.productFeedback.findFirst({
      where: {
        id: questionId,
        feedbackType: FeedbackType.QUESTION,
        parentId: null,
        hasAnswer: true,
      },
      include: {
        replies: {
          where: { status: FeedbackStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!question) {
      throw new NotFoundException('답변된 문의를 찾을 수 없습니다');
    }

    const answer = question.replies[0];
    const now = getNowKST();

    if (answer) {
      // 기존 답변이 있으면 수정
      await this.prisma.productFeedback.update({
        where: { id: answer.id },
        data: {
          content,
          updatedAt: now,
        },
      });
    } else {
      // 답변 레코드가 없으면 새로 생성 (hasAnswer만 true인 잘못된 데이터 대응)
      await this.prisma.productFeedback.create({
        data: {
          productId: question.productId,
          userId: operatorId,
          feedbackType: FeedbackType.QUESTION,
          parentId: questionId,
          content,
          status: FeedbackStatus.ACTIVE,
          createdAt: now,
        },
      });
    }

    // 원글 업데이트
    await this.prisma.productFeedback.update({
      where: { id: questionId },
      data: {
        answeredBy: operatorId,
        answeredAt: now,
      },
    });

    this.logger.log(`문의 답변 수정: 문의 ID ${questionId}, 관리자 ID ${operatorId}`);

    return { success: true };
  }
}
