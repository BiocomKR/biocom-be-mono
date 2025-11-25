import { Controller, Get, Post, Param, ParseIntPipe, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QuizCompletionService } from './quiz-completion.service';
import { CompleteQuizDto, CompleteLectureQuizDto, QuizCompletionResponseDto } from './dto/quiz-completion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 퀴즈 완료 컨트롤러
 * 퀴즈 답변 제출 및 채점 처리
 */
@ApiTags('챌린지-퀴즈')
@Controller('quizzes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuizCompletionController {
  constructor(private readonly quizCompletionService: QuizCompletionService) {}

  /**
   * 오늘의 퀴즈 조회
   * @description 현재 챌린지 일차의 퀴즈를 조회합니다
   */
  @Get('daily')
  @ApiOperation({
    summary: '오늘의 퀴즈 조회',
    description: '현재 챌린지 일차의 퀴즈를 조회합니다'
  })
  @ApiResponse({
    status: 200,
    description: '오늘의 퀴즈 조회 성공'
  })
  async getDailyQuizzes(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.quizCompletionService.getDailyQuizzes(userId);
  }

  /**
   * 퀴즈 답변 제출 및 완료 처리
   * @description 퀴즈 답변을 제출하고 채점하여 포인트를 적립합니다
   */
  @Post('complete')
  @ApiOperation({
    summary: '퀴즈 답변 제출',
    description: '퀴즈 답변을 제출하고 채점합니다. 정답일 경우 포인트가 적립되며, 챌린지와 연동되어 진행상황이 업데이트됩니다.'
  })
  @ApiResponse({
    status: 201,
    description: '퀴즈 답변 제출 성공',
    type: QuizCompletionResponseDto
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (이미 답변한 퀴즈, 잘못된 데이터 등)'
  })
  @ApiResponse({
    status: 404,
    description: '퀴즈를 찾을 수 없음'
  })
  async completeQuiz(
    @Body() dto: CompleteQuizDto,
    @Request() req: any
  ) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    return this.quizCompletionService.completeQuiz(userId, dto);
  }

  /**
   * 강의 퀴즈 답변 제출 및 완료 처리
   * @description 강의 연결 퀴즈 답변을 제출하고 채점하여 포인트를 적립합니다
   * - 챌린저 당일 퀴즈 (currentDay === dayNumber): 200점 지급
   * - 챌린저 과거 퀴즈 (currentDay > dayNumber): 포인트 지급 안함
   * - 구독자: 퀴즈 풀이 불가 (강의 상세 API에서 차단)
   */
  @Post('lecture/complete')
  @ApiOperation({
    summary: '강의 퀴즈 답변 제출',
    description: `강의 연결 퀴즈 답변을 제출합니다.

**포인트 지급 규칙**:
- 챌린저 당일 퀴즈 (currentDay === dayNumber): 최초 1회 200점 지급
- 챌린저 과거 퀴즈 (currentDay > dayNumber): 포인트 지급 안함 (퀴즈는 풀 수 있음)
- 재시도: 언제든지 가능하지만 포인트는 최초 1회만 지급

**요청 Body**:
- quizId: 퀴즈 ID (number)
- selectedAnswer: 선택한 답변 번호 (1~4)`
  })
  @ApiResponse({
    status: 201,
    description: '강의 퀴즈 답변 제출 성공'
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (아직 접근할 수 없는 퀴즈 등)'
  })
  @ApiResponse({
    status: 404,
    description: '퀴즈를 찾을 수 없음'
  })
  async completeLectureQuiz(
    @Body() dto: CompleteLectureQuizDto,
    @Request() req: any
  ) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    return this.quizCompletionService.completeLectureQuiz(userId, dto.quizId, dto.selectedAnswer);
  }
}