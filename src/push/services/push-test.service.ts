import { Injectable } from '@nestjs/common';
import { FcmProvider } from '../providers/fcm.provider';

/**
 * 푸시 알림 테스트 서비스
 *
 * FCM 푸시 발송 테스트용 간단한 서비스
 */
@Injectable()
export class PushTestService {
  constructor(private readonly fcmProvider: FcmProvider) {}

  /**
   * FCM 토큰으로 테스트 푸시 발송
   *
   * @param token - FCM 토큰
   * @param title - 알림 제목
   * @param body - 알림 본문
   * @returns 발송 결과
   */
  async sendTestPush(token: string, title: string, body: string) {
    console.log('🧪 [PushTestService] 테스트 푸시 발송 시도:', {
      title,
      body: body?.substring(0, 50),
      tokenPrefix: token?.substring(0, 20) + '...',
    });

    const result = await this.fcmProvider.sendToToken(
      token,
      { title, body },
    );

    if (result.success) {
      console.log('✅ [PushTestService] 푸시 발송 성공:', {
        messageId: result.messageId,
        title,
      });
    } else {
      console.error('❌ [PushTestService] 푸시 발송 실패:', {
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        title,
      });
    }

    return result;
  }
}
