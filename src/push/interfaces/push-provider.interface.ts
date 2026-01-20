/**
 * 푸시 Provider DI 토큰
 */
export const PUSH_PROVIDER_TOKEN = 'PUSH_PROVIDER';

/**
 * 푸시 알림 메시지 인터페이스
 */
export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  silent?: boolean;
}

/**
 * 푸시 발송 결과 인터페이스
 */
export interface PushSendResult {
  success: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * 푸시 제공자 공통 인터페이스
 */
export interface IPushProvider {
  readonly name: string;
  sendToToken(token: string, message: PushMessage, maxRetries?: number, bundleId?: string): Promise<PushSendResult>;
  sendToMultiple(
    tokensData: any[],
    message: PushMessage,
  ): Promise<PushSendResult[]>;
  validateToken(tokenData: any): Promise<boolean>;
  subscribeToTopic(tokens: string[], topic: string, bundleId?: string): Promise<boolean>;
  unsubscribeFromTopic(tokens: string[], topic: string, bundleId?: string): Promise<boolean>;
  sendToTopic(topic: string, message: PushMessage, bundleId?: string): Promise<PushSendResult>;
}
