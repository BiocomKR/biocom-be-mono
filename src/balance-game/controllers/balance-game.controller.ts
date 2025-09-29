import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  ValidationPipe
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth
} from '@nestjs/swagger';
import { BalanceGameService } from '../services/balance-game.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  TodayBalanceGameResponseDto,
  BalanceGameStepResponseDto,
  BalanceGameChoiceDto,
  BalanceGameCompleteResponseDto,
  BalanceGameProgressResponseDto
} from '../dto/balance-game.dto';

@ApiTags('밸런스게임')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('balance-game')
export class BalanceGameController {
  constructor(private readonly balanceGameService: BalanceGameService) {}

  /**
   * 오늘의 밸런스게임 조회
   */
  @Get('today')
  @ApiOperation({
    summary: '오늘의 밸런스게임 조회',
    description: '날짜별로 스케줄된 오늘의 밸런스게임을 조회합니다. 이미 플레이했는지 여부도 함께 반환됩니다.'
  })
  @ApiResponse({ status: 200, description: '성공', type: TodayBalanceGameResponseDto })
  @ApiResponse({ status: 404, description: '오늘 예정된 밸런스게임이 없음' })
  async getTodayBalanceGame(@Req() req: any): Promise<TodayBalanceGameResponseDto> {
    const userId = req.user.id;
    return this.balanceGameService.getTodayBalanceGame(userId);
  }

  /**
   * 밸런스게임 시작
   */
  @Post(':gameId/start')
  @ApiOperation({
    summary: '밸런스게임 시작',
    description: '밸런스게임을 시작하고 첫 번째 질문 단계를 반환합니다.'
  })
  @ApiParam({ name: 'gameId', description: '게임 ID' })
  @ApiResponse({ status: 200, description: '게임 시작 성공', type: BalanceGameStepResponseDto })
  @ApiResponse({ status: 404, description: '게임을 찾을 수 없음' })
  @ApiResponse({ status: 409, description: '오늘 이미 완료한 게임' })
  async startBalanceGame(
    @Req() req: any,
    @Param('gameId', ParseIntPipe) gameId: number
  ): Promise<BalanceGameStepResponseDto> {
    const userId = req.user.id;
    return this.balanceGameService.startBalanceGame(userId, gameId);
  }

  /**
   * 밸런스게임 선택 처리
   */
  @Post(':gameId/steps/:stepId/choice')
  @ApiOperation({
    summary: '밸런스게임 선택 처리',
    description: '현재 단계에서 선택을 하고 다음 단계를 받습니다.'
  })
  @ApiParam({ name: 'gameId', description: '게임 ID' })
  @ApiParam({ name: 'stepId', description: '현재 단계 ID' })
  @ApiBody({ type: BalanceGameChoiceDto })
  @ApiResponse({ status: 200, description: '선택 처리 성공', type: BalanceGameProgressResponseDto })
  @ApiResponse({ status: 404, description: '게임 단계를 찾을 수 없음' })
  async makeChoice(
    @Req() req: any,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body(ValidationPipe) dto: BalanceGameChoiceDto
  ): Promise<BalanceGameProgressResponseDto> {
    const userId = req.user.id;
    return this.balanceGameService.makeChoice(userId, gameId, stepId, dto);
  }

  /**
   * 밸런스게임 완료
   */
  @Post(':gameId/complete')
  @ApiOperation({
    summary: '밸런스게임 완료',
    description: '밸런스게임을 완료하고 보상(뱃지, 쿠폰)을 획득합니다.'
  })
  @ApiParam({ name: 'gameId', description: '게임 ID' })
  @ApiBody({
    description: '게임 중 선택한 옵션들',
    schema: {
      type: 'object',
      properties: {
        selectedOptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              step: { type: 'number' },
              option: { type: 'number' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: '게임 완료 성공', type: BalanceGameCompleteResponseDto })
  @ApiResponse({ status: 409, description: '오늘 이미 완료한 게임' })
  async completeBalanceGame(
    @Req() req: any,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() body: { selectedOptions: Array<{ step: number; option: number }> }
  ): Promise<BalanceGameCompleteResponseDto> {
    const userId = req.user.id;
    return this.balanceGameService.completeBalanceGame(userId, gameId, body.selectedOptions);
  }

}