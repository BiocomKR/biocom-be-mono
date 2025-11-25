import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';

export type QuizDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * 백오피스 퀴즈 관리 서비스
 */
@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 모든 퀴즈 목록 조회
   */
  async getAllQuizzes() {
    const quizzes = await this.prisma.quiz.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return quizzes;
  }

  /**
   * 퀴즈 ID로 조회
   */
  async getQuizById(id: number) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        challengeQuizzes: {
          include: {
            challenge: true,
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException(`퀴즈를 찾을 수 없습니다: ${id}`);
    }

    return quiz;
  }

  /**
   * 새로운 퀴즈 생성
   */
  async createQuiz(createQuizDto: {
    title: string;
    question: string;
    options: string[];
    correctAnswer: number;
    points?: number;
    category?: string;
    difficulty?: QuizDifficulty;
  }) {
    if (!createQuizDto.options || createQuizDto.options.length < 2) {
      throw new BadRequestException('최소 2개 이상의 선택지가 필요합니다.');
    }

    if (createQuizDto.correctAnswer < 0 || createQuizDto.correctAnswer >= createQuizDto.options.length) {
      throw new BadRequestException('올바르지 않은 정답 번호입니다.');
    }

    const quiz = await this.prisma.quiz.create({
      data: {
        title: createQuizDto.title,
        question: createQuizDto.question,
        options: createQuizDto.options,
        correctAnswer: createQuizDto.correctAnswer,
        points: createQuizDto.points || 50,
        category: createQuizDto.category,
        difficulty: createQuizDto.difficulty,
        createdAt: getNowKST(),
      },
    });

    return quiz;
  }

  /**
   * 퀴즈 수정
   */
  async updateQuiz(
    id: number,
    updateQuizDto: Partial<{
      title: string;
      question: string;
      options: string[];
      correctAnswer: number;
      points: number;
      category: string;
      difficulty: QuizDifficulty;
      isActive: boolean;
    }>
  ) {
    await this.getQuizById(id);

    if (updateQuizDto.options) {
      if (updateQuizDto.options.length < 2) {
        throw new BadRequestException('최소 2개 이상의 선택지가 필요합니다.');
      }

      const correctAnswer = updateQuizDto.correctAnswer ?? (await this.prisma.quiz.findUnique({ where: { id } }))?.correctAnswer;
      if (correctAnswer !== undefined && (correctAnswer < 0 || correctAnswer >= updateQuizDto.options.length)) {
        throw new BadRequestException('올바르지 않은 정답 번호입니다.');
      }
    }

    const quiz = await this.prisma.quiz.update({
      where: { id },
      data: updateQuizDto,
    });

    return quiz;
  }

  /**
   * 퀴즈 삭제
   */
  async deleteQuiz(id: number) {
    const challengeQuizCount = await this.prisma.challengeQuiz.count({
      where: { quizId: id },
    });

    if (challengeQuizCount > 0) {
      throw new BadRequestException(`이미 챌린지에서 사용 중인 퀴즈는 삭제할 수 없습니다.`);
    }

    const answerCount = await this.prisma.quizAnswer.count({
      where: {
        challengeQuiz: {
          quizId: id,
        },
      },
    });

    if (answerCount > 0) {
      throw new BadRequestException(`답변이 존재하는 퀴즈는 삭제할 수 없습니다.`);
    }

    await this.prisma.quiz.delete({
      where: { id },
    });
  }

  /**
   * 페이징 처리된 퀴즈 목록 조회
   */
  async getQuizzesWithPagination(
    page: number,
    limit: number,
    filters: {
      search?: string;
      category?: string;
      difficulty?: string;
      isActive?: boolean;
    },
    sort: {
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { question: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.category) where.category = filters.category;
    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [items, total] = await Promise.all([
      this.prisma.quiz.findMany({
        where,
        include: {
          _count: {
            select: {
              challengeQuizzes: true,
            },
          },
        },
        orderBy: { [sort.sortBy]: sort.sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quiz.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
