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
   * 밸런스게임 질문 조회
   */
  @Post(':gameId/steps/:stepNumber')
  @ApiOperation({
    summary: '밸런스게임 질문 조회',
    description: '해당 stepNumber의 밸런스게임 질문 정보를 조회합니다.'
  })
  @ApiParam({ name: 'gameId', description: '게임 ID' })
  @ApiParam({ name: 'stepNumber', description: '조회할 단계 번호' })
  @ApiBody({ type: BalanceGameChoiceDto, required: false })
  @ApiResponse({ status: 200, description: '질문 조회 성공', type: BalanceGameProgressResponseDto })
  @ApiResponse({ status: 404, description: '게임 단계를 찾을 수 없음' })
  async getGameStep(
    @Req() req: any,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Param('stepNumber', ParseIntPipe) stepNumber: number,
    @Body() dto?: BalanceGameChoiceDto
  ): Promise<BalanceGameProgressResponseDto> {
    const userId = req.user.id;
    return this.balanceGameService.getGameStep(userId, gameId, stepNumber, dto);
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