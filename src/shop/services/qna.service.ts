import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  CreateQnaDto,
  UpdateQnaDto,
  CreateQnaAnswerDto,
  QnaQueryDto,
  QnaResponseDto,
  QnaPaginatedResponseDto,
  QnaSortType,
  QnaFilterType
} from '../dto/qna/qna.dto';
import { Prisma } from '@prisma/client';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * 상품 Q&A 서비스
 * ProductFeedback 테이블의 feedbackType='QUESTION'을 활용
 */
@Injectable()
export class QnaService {
  private readonly logger = new Logger(QnaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Q&A 작성
   * 로그인한 사용자라면 누구나 질문 작성 가능
   */
  async createQuestion(userId: number, dto: CreateQnaDto): Promise<QnaResponseDto> {
    this.logger.log(`사용자 ${userId}가 상품 ${dto.productId} Q&A 작성 시도`);

    // 상품 존재 확인
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId }
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    // Q&A 작성
    const question = await this.prisma.productFeedback.create({
      data: {
        userId,
        productId: dto.productId,
        feedbackType: 'QUESTION',
        title: dto.title,
        content: dto.content,
        questionType: dto.questionType,
        isSecret: dto.isSecret || false,
        hasAnswer: false,
        createdAt: getNowKST(),
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
        },
        replies: {
          where: {
            status: 'ACTIVE'
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
    });

    this.logger.log(`Q&A 작성 완료: ${question.id}`);

    return this.formatQnaResponse(question);
  }

  /**
   * Q&A 목록 조회 (페이지네이션)
   */
  async findQuestions(query: QnaQueryDto): Promise<QnaPaginatedResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // WHERE 조건 구성
    const where: Prisma.ProductFeedbackWhereInput = {
      feedbackType: 'QUESTION',
      status: 'ACTIVE',
      parentId: null // 원글만 조회 (답글 제외)
    };

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.questionType) {
      where.questionType = query.questionType;
    }

    // 답변 여부 필터
    if (query.filter === QnaFilterType.ANSWERED) {
      where.hasAnswer = true;
    } else if (query.filter === QnaFilterType.UNANSWERED) {
      where.hasAnswer = false;
    }

    // 정렬 조건 구성
    let orderBy: Prisma.ProductFeedbackOrderByWithRelationInput[] = [];
    switch (query.sort) {
      case QnaSortType.LATEST:
        orderBy = [{ createdAt: 'desc' }];
        break;
      case QnaSortType.OLDEST:
        orderBy = [{ createdAt: 'asc' }];
        break;
      case QnaSortType.ANSWERED:
        orderBy = [{ hasAnswer: 'desc' }, { createdAt: 'desc' }];
        break;
      case QnaSortType.UNANSWERED:
        orderBy = [{ hasAnswer: 'asc' }, { createdAt: 'desc' }];
        break;
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    // 데이터 조회
    const [questions, total, answeredCount, unansweredCount] = await Promise.all([
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
              status: 'ACTIVE'
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
      this.prisma.productFeedback.count({ where }),
      this.prisma.productFeedback.count({
        where: {
          ...where,
          hasAnswer: true
        }
      }),
      this.prisma.productFeedback.count({
        where: {
          ...where,
          hasAnswer: false
        }
      })
    ]);

    return {
      items: questions.map(question => this.formatQnaResponse(question)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      answeredCount,
      unansweredCount
    };
  }

  /**
   * Q&A 상세 조회
   */
  async findQuestionById(id: number, userId?: number): Promise<QnaResponseDto> {
    const question = await this.prisma.productFeedback.findFirst({
      where: {
        id,
        feedbackType: 'QUESTION',
        status: 'ACTIVE'
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
        },
        replies: {
          where: {
            status: 'ACTIVE'
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
    });

    if (!question) {
      throw new NotFoundException('Q&A를 찾을 수 없습니다');
    }

    // 비밀글인 경우 작성자만 조회 가능
    if (question.isSecret && userId && question.userId !== userId) {
      throw new ForbiddenException('비밀글은 작성자만 조회할 수 있습니다');
    }

    return this.formatQnaResponse(question);
  }

  /**
   * Q&A 수정
   * 작성자만 수정 가능
   */
  async updateQuestion(userId: number, id: number, dto: UpdateQnaDto): Promise<QnaResponseDto> {
    this.logger.log(`사용자 ${userId}가 Q&A ${id} 수정 시도`);

    // Q&A 존재 확인 및 권한 검증
    const existingQuestion = await this.prisma.productFeedback.findFirst({
      where: {
        id,
        feedbackType: 'QUESTION',
        status: 'ACTIVE'
      }
    });

    if (!existingQuestion) {
      throw new NotFoundException('Q&A를 찾을 수 없습니다');
    }

    if (existingQuestion.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 Q&A만 수정할 수 있습니다');
    }

    // 답변이 달린 경우 수정 불가
    if (existingQuestion.hasAnswer) {
      throw new BadRequestException('답변이 달린 질문은 수정할 수 없습니다');
    }

    // Q&A 수정
    const updatedQuestion = await this.prisma.productFeedback.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        questionType: dto.questionType,
        isSecret: dto.isSecret
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
        },
        replies: {
          where: {
            status: 'ACTIVE'
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
    });

    this.logger.log(`Q&A 수정 완료: ${id}`);

    return this.formatQnaResponse(updatedQuestion);
  }

  /**
   * Q&A 삭제
   * 작성자만 삭제 가능 (소프트 삭제)
   */
  async deleteQuestion(userId: number, id: number): Promise<{ success: boolean; message: string }> {
    this.logger.log(`사용자 ${userId}가 Q&A ${id} 삭제 시도`);

    // Q&A 존재 확인 및 권한 검증
    const existingQuestion = await this.prisma.productFeedback.findFirst({
      where: {
        id,
        feedbackType: 'QUESTION',
        status: 'ACTIVE'
      }
    });

    if (!existingQuestion) {
      throw new NotFoundException('Q&A를 찾을 수 없습니다');
    }

    if (existingQuestion.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 Q&A만 삭제할 수 있습니다');
    }

    // 소프트 삭제
    await this.prisma.productFeedback.update({
      where: { id },
      data: {
        status: 'DELETED'
      }
    });

    this.logger.log(`Q&A 삭제 완료: ${id}`);

    return {
      success: true,
      message: 'Q&A가 삭제되었습니다'
    };
  }

  /**
   * Q&A 답변 작성 (관리자용)
   * 답글 형태로 저장
   */
  async createAnswer(
    adminId: number,
    questionId: number,
    dto: CreateQnaAnswerDto
  ): Promise<QnaResponseDto> {
    this.logger.log(`관리자 ${adminId}가 Q&A ${questionId}에 답변 작성 시도`);

    // 원글 존재 확인
    const question = await this.prisma.productFeedback.findFirst({
      where: {
        id: questionId,
        feedbackType: 'QUESTION',
        status: 'ACTIVE'
      }
    });

    if (!question) {
      throw new NotFoundException('Q&A를 찾을 수 없습니다');
    }

    // 이미 답변이 있는지 확인
    if (question.hasAnswer) {
      throw new BadRequestException('이미 답변이 작성되었습니다');
    }

    // 답변 작성 (답글 형태)
    const answer = await this.prisma.productFeedback.create({
      data: {
        userId: adminId,
        productId: question.productId,
        feedbackType: 'QUESTION',
        parentId: questionId,
        content: dto.content,
        createdAt: getNowKST(),
      }
    });

    // 원글에 답변 완료 표시
    const updatedQuestion = await this.prisma.productFeedback.update({
      where: { id: questionId },
      data: {
        hasAnswer: true,
        answeredBy: adminId,
        answeredAt: getNowKST()
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
        },
        replies: {
          where: {
            status: 'ACTIVE'
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
    });

    this.logger.log(`Q&A 답변 작성 완료: ${answer.id}`);

    return this.formatQnaResponse(updatedQuestion);
  }

  /**
   * Q&A 답변 수정 (관리자용)
   */
  async updateAnswer(
    adminId: number,
    questionId: number,
    dto: CreateQnaAnswerDto
  ): Promise<QnaResponseDto> {
    this.logger.log(`관리자 ${adminId}가 Q&A ${questionId} 답변 수정 시도`);

    // 원글 존재 확인
    const question = await this.prisma.productFeedback.findFirst({
      where: {
        id: questionId,
        feedbackType: 'QUESTION',
        status: 'ACTIVE'
      },
      include: {
        replies: {
          where: {
            status: 'ACTIVE'
          }
        }
      }
    });

    if (!question) {
      throw new NotFoundException('Q&A를 찾을 수 없습니다');
    }

    if (!question.hasAnswer || question.replies.length === 0) {
      throw new NotFoundException('답변이 존재하지 않습니다');
    }

    // 답변 수정
    const answer = question.replies[0];
    await this.prisma.productFeedback.update({
      where: { id: answer.id },
      data: {
        content: dto.content
      }
    });

    // 최신 데이터 조회
    const updatedQuestion = await this.prisma.productFeedback.findUnique({
      where: { id: questionId },
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
            status: 'ACTIVE'
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
    });

    this.logger.log(`Q&A 답변 수정 완료: ${answer.id}`);

    return this.formatQnaResponse(updatedQuestion!);
  }

  /**
   * Q&A 답변 삭제 (관리자용)
   */
  async deleteAnswer(adminId: number, questionId: number): Promise<{ success: boolean; message: string }> {
    this.logger.log(`관리자 ${adminId}가 Q&A ${questionId} 답변 삭제 시도`);

    // 원글 존재 확인
    const question = await this.prisma.productFeedback.findFirst({
      where: {
        id: questionId,
        feedbackType: 'QUESTION',
        status: 'ACTIVE'
      },
      include: {
        replies: {
          where: {
            status: 'ACTIVE'
          }
        }
      }
    });

    if (!question) {
      throw new NotFoundException('Q&A를 찾을 수 없습니다');
    }

    if (!question.hasAnswer || question.replies.length === 0) {
      throw new NotFoundException('답변이 존재하지 않습니다');
    }

    // 답변 삭제 (소프트 삭제)
    const answer = question.replies[0];
    await this.prisma.productFeedback.update({
      where: { id: answer.id },
      data: {
        status: 'DELETED'
      }
    });

    // 원글에 답변 해제 표시
    await this.prisma.productFeedback.update({
      where: { id: questionId },
      data: {
        hasAnswer: false,
        answeredBy: null,
        answeredAt: null
      }
    });

    this.logger.log(`Q&A 답변 삭제 완료: ${answer.id}`);

    return {
      success: true,
      message: 'Q&A 답변이 삭제되었습니다'
    };
  }

  /**
   * Q&A 응답 데이터 포맷팅
   */
  private formatQnaResponse(question: any): QnaResponseDto {
    // 답글에서 답변 추출
    const answer = question.replies && question.replies.length > 0 ? question.replies[0] : null;

    return {
      id: question.id,
      productId: question.productId,
      userId: question.userId,
      userName: this.maskUserName(question.user.name),
      title: question.title,
      content: question.content,
      questionType: question.questionType,
      isSecret: question.isSecret,
      hasAnswer: question.hasAnswer,
      answer: answer?.content,
      answeredBy: question.answeredBy,
      answererName: answer?.user ? answer.user.name : undefined,
      answeredAt: question.answeredAt?.toISOString(),
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt?.toISOString(),
      product: question.product ? {
        id: question.product.id,
        name: question.product.name,
        sku: question.product.sku
      } : undefined
    };
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
}
