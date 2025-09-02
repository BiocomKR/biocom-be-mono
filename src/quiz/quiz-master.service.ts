import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { PaginationHelper, PaginatedResult } from '../common/utils/pagination.util';
import { QuizDifficulty } from './quiz.types';

/**
 * 퀴즈 마스터 서비스
 * 재사용 가능한 퀴즈 문제들을 관리
 */
@Injectable()
export class QuizMasterService {
  private readonly logger = new Logger(QuizMasterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 모든 퀴즈 목록 조회
   */
  async getAllQuizzes() {
    this.logger.log('모든 퀴즈 목록 조회');

    const quizzes = await this.prisma.quiz.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(`퀴즈 목록 조회 완료 - 총 ${quizzes.length}개`);
    return quizzes;
  }

  /**
   * 퀴즈 ID로 조회
   */
  async getQuizById(id: number) {
    this.logger.log(`퀴즈 상세 조회 - ID: ${id}`);

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
    this.logger.log(`퀴즈 생성 - 제목: ${createQuizDto.title}`);

    // 옵션 검증
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
      },
    });

    this.logger.log(`퀴즈 생성 완료 - ID: ${quiz.id}`);
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
    this.logger.log(`퀴즈 수정 - ID: ${id}`);

    // 퀴즈 존재 확인
    await this.getQuizById(id);

    // 옵션 검증
    if (updateQuizDto.options) {
      if (updateQuizDto.options.length < 2) {
        throw new BadRequestException('최소 2개 이상의 선택지가 필요합니다.');
      }

      // correctAnswer도 함께 업데이트하는 경우 검증
      const correctAnswer = updateQuizDto.correctAnswer ?? (await this.prisma.quiz.findUnique({ where: { id } }))?.correctAnswer;
      if (correctAnswer !== undefined && (correctAnswer < 0 || correctAnswer >= updateQuizDto.options.length)) {
        throw new BadRequestException('올바르지 않은 정답 번호입니다.');
      }
    }

    const quiz = await this.prisma.quiz.update({
      where: { id },
      data: updateQuizDto,
    });

    this.logger.log(`퀴즈 수정 완료 - ID: ${id}`);
    return quiz;
  }

  /**
   * 퀴즈 삭제
   */
  async deleteQuiz(id: number) {
    this.logger.log(`퀴즈 삭제 - ID: ${id}`);

    // 챌린지와 연결된 퀴즈인지 확인
    const challengeQuizCount = await this.prisma.challengeQuiz.count({
      where: { quizId: id },
    });

    if (challengeQuizCount > 0) {
      throw new BadRequestException(`이미 챌린지에서 사용 중인 퀴즈는 삭제할 수 없습니다. (연결된 챌린지 수: ${challengeQuizCount})`);
    }

    // 답변이 있는지 확인
    const answerCount = await this.prisma.quizAnswer.count({
      where: {
        challengeQuiz: {
          quizId: id,
        },
      },
    });

    if (answerCount > 0) {
      throw new BadRequestException(`답변이 존재하는 퀴즈는 삭제할 수 없습니다. (답변 수: ${answerCount})`);
    }

    await this.prisma.quiz.delete({
      where: { id },
    });

    this.logger.log(`퀴즈 삭제 완료 - ID: ${id}`);
  }

  /**
   * 카테고리별 퀴즈 조회
   */
  async getQuizzesByCategory(category: string) {
    this.logger.log(`카테고리별 퀴즈 조회 - 카테고리: ${category}`);

    const quizzes = await this.prisma.quiz.findMany({
      where: {
        category,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(`카테고리별 퀴즈 조회 완료 - 카테고리: ${category}, 퀴즈 수: ${quizzes.length}`);
    return quizzes;
  }

  /**
   * 난이도별 퀴즈 조회
   */
  async getQuizzesByDifficulty(difficulty: string) {
    this.logger.log(`난이도별 퀴즈 조회 - 난이도: ${difficulty}`);

    const quizzes = await this.prisma.quiz.findMany({
      where: {
        difficulty,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(`난이도별 퀴즈 조회 완료 - 난이도: ${difficulty}, 퀴즈 수: ${quizzes.length}`);
    return quizzes;
  }

  /**
   * 페이징 처리된 퀴즈 목록 조회
   * 
   * @param page 페이지 번호
   * @param limit 페이지당 항목 수
   * @param filters 필터 조건
   * @param sort 정렬 조건
   * @returns 페이징 처리된 퀴즈 목록
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
  ): Promise<PaginatedResult<any>> {
    this.logger.log(`페이징 처리된 퀴즈 목록 조회 - page: ${page}, limit: ${limit}`);

    // WHERE 조건 구성
    const where: any = {};

    // 검색어 필터
    if (filters.search) {
      const searchCondition = PaginationHelper.createSearchCondition(filters.search, ['title', 'question']);
      if (searchCondition) {
        Object.assign(where, searchCondition);
      }
    }

    // 기타 필터
    const additionalFilters = PaginationHelper.buildWhereClause({
      category: filters.category,
      difficulty: filters.difficulty,
      isActive: filters.isActive,
    });
    
    Object.assign(where, additionalFilters);

    // 페이징 처리
    const result = await PaginationHelper.paginate(
      this.prisma.quiz,
      { page, limit },
      {
        where,
        include: {
          _count: {
            select: {
              challengeQuizzes: true,
            },
          },
        },
      },
      sort
    );

    this.logger.log(`페이징 처리된 퀴즈 목록 조회 완료 - 총 ${result.total}개, ${result.totalPages} 페이지`);

    return result;
  }
}