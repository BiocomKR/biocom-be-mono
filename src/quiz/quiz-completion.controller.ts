import { Controller, Get, Post, Param, ParseIntPipe, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QuizCompletionService } from './quiz-completion.service';
import { CompleteQuizDto, QuizCompletionResponseDto } from './dto/quiz-completion.dto';
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
}