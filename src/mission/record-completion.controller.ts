import { Controller, Post, Param, ParseIntPipe, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
// import { RecordsService } from './records.service'; // 임시 주석
import { CompleteRecordDto, RecordCompletionResponseDto } from './dto/record-completion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 기록 완료 컨트롤러
 * 사용자의 기록 생성 및 연관 미션 처리
 */
@ApiTags('records')
@Controller('records')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecordsController {
  // constructor(private readonly recordsService: RecordsService) {} // 임시 주석

  /**
   * 기록 완료 처리
   * @description 기록을 생성하고, 연관된 활성 미션이 있다면 자동으로 미션 완료 처리
   */
  @Post(':id/complete')
  @ApiOperation({
    summary: '기록 완료',
    description: '기록을 생성합니다. 활성 챌린지에서 해당 기록타입의 미션이 있다면 자동으로 미션 완료 처리 및 포인트를 적립합니다.'
  })
  @ApiResponse({
    status: 201,
    description: '기록 생성 성공',
    type: RecordCompletionResponseDto
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (이미 완료된 기록, 잘못된 데이터 등)'
  })
  @ApiResponse({
    status: 404,
    description: '기록 항목을 찾을 수 없음'
  })
  async completeRecord(
    @Param('id', ParseIntPipe) recordId: number,
    @Body() dto: CompleteRecordDto,
    @Request() req: any
  ) {
    // return this.recordsService.completeRecord(
    //   req.user.userId, 
    //   recordId, 
    //   dto
    // );
    throw new Error('임시 비활성화됨');
  }
}