import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PushTestService } from '../services/push-test.service';
import { SendTestPushDto } from '../dto/send-test-push.dto';

/**
 * 푸시 알림 테스트 컨트롤러
 *
 * FCM 푸시 발송 테스트용 API
 */
@ApiTags('푸시-테스트')
@Controller('push-test')
export class PushTestController {
  constructor(private readonly pushTestService: PushTestService) {}

  /**
   * 테스트 엔드포인트
   *
   * 컨트롤러가 정상적으로 등록되었는지 확인
   */
  @Get('test')
  @ApiOperation({
    summary: '테스트 엔드포인트',
    description: 'Push 컨트롤러가 정상 작동하는지 테스트',
  })
  test() {
    return '테스트';
  }

  /**
   * FCM 테스트 푸시 발송
   *
   * 프론트에서 받은 FCM 토큰으로 테스트 푸시 발송
   *
   * @param dto - 푸시 발송 정보 (토큰, 제목, 본문)
   * @returns 발송 결과
   */
  @Post('send')
  @ApiOperation({
    summary: 'FCM 테스트 푸시 발송',
    description: '프론트에서 받은 FCM 토큰으로 테스트 푸시 알림을 발송합니다',
  })
  @ApiResponse({
    status: 200,
    description: '푸시 발송 성공',
    schema: {
      example: {
        success: true,
        messageId: 'projects/biocomchallengedev/messages/0:1234567890',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '푸시 발송 실패',
    schema: {
      example: {
        success: false,
        errorCode: 'messaging/invalid-registration-token',
        errorMessage:
          'The registration token is not a valid FCM registration token',
      },
    },
  })
  async sendTestPush(@Body() dto: SendTestPushDto) {
    return await this.pushTestService.sendTestPush(
      dto.token,
      dto.title,
      dto.body,
    );
  }
}
