import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PushTopicService } from '../services/push-topic.service';
import { SubscribeTopicDto } from '../dto/subscribe-topic.dto';
import { UnsubscribeTopicDto } from '../dto/unsubscribe-topic.dto';
import { SendPushToTopicDto } from '../dto/send-push-to-topic.dto';

/**
 * 푸시 Topic 관리 컨트롤러
 *
 * FCM Topic 구독/해제 및 Topic 기반 푸시 발송 API
 */
@ApiTags('푸시-Topic')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push/topics')
export class PushTopicController {
  constructor(private readonly pushTopicService: PushTopicService) {}

  /**
   * Topic 구독
   *
   * @param req - JWT 인증된 요청
   * @param dto - 구독 정보
   * @returns 구독 결과
   */
  @Post('subscribe')
  @ApiOperation({
    summary: 'Topic 구독',
    description: 'FCM Topic을 구독합니다 (예: marketing, all-users 등)',
  })
  @ApiResponse({
    status: 201,
    description: 'Topic 구독 성공',
  })
  async subscribeTopic(@Req() req: any, @Body() dto: SubscribeTopicDto) {
    const userId = req.user.id;
    return await this.pushTopicService.subscribeTopic(userId, dto);
  }

  /**
   * Topic 구독 해제
   *
   * @param req - JWT 인증된 요청
   * @param dto - 구독 해제 정보
   * @returns 구독 해제 결과
   */
  @Post('unsubscribe')
  @ApiOperation({
    summary: 'Topic 구독 해제',
    description: 'FCM Topic 구독을 해제합니다',
  })
  @ApiResponse({
    status: 201,
    description: 'Topic 구독 해제 성공',
  })
  async unsubscribeTopic(@Req() req: any, @Body() dto: UnsubscribeTopicDto) {
    const userId = req.user.id;
    return await this.pushTopicService.unsubscribeTopic(userId, dto);
  }

  /**
   * Topic으로 푸시 전송 (관리자 전용)
   *
   * @param dto - Topic 푸시 정보
   * @returns 전송 결과
   */
  @Post('send')
  @ApiOperation({
    summary: 'Topic으로 푸시 전송 (관리자)',
    description: '특정 Topic에 구독한 모든 유저에게 푸시를 전송합니다',
  })
  @ApiResponse({
    status: 201,
    description: '푸시 전송 성공',
  })
  async sendToTopic(@Body() dto: SendPushToTopicDto) {
    return await this.pushTopicService.sendToTopic(dto);
  }
}
