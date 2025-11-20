/**
 * 푸시 알림 메시지 인터페이스
 *
 * 모든 푸시 서비스에서 공통으로 사용하는 메시지 구조
 */
export interface PushMessage {
  /// 알림 제목
  title: string;

  /// 알림 본문
  body: string;

  /// 추가 데이터 (주문번호, 미션ID, 딥링크 URL 등)
  data?: Record<string, any>;

  /// 이미지 URL (선택사항)
  imageUrl?: string;
}

/**
 * 푸시 발송 결과 인터페이스
 *
 * 발송 성공/실패 여부 및 상세 정보
 */
export interface PushSendResult {
  /// 발송 성공 여부
  success: boolean;

  /// 메시지 ID (성공 시)
  messageId?: string;

  /// 에러 코드 (실패 시)
  errorCode?: string;

  /// 에러 메시지 (실패 시)
  errorMessage?: string;
}

/**
 * 푸시 제공자 공통 인터페이스
 *
 * FCM, OneSignal, APNs 등 모든 푸시 서비스가 구현해야 하는 인터페이스
 * Provider 패턴을 통해 서비스 교체 시 비즈니스 로직 변경 없이 확장 가능
 *
 * @example
 * ```typescript
 * // FCM Provider 구현
 * class FcmProvider implements IPushProvider {
 *   readonly name = 'FCM';
 *
 *   async sendToToken(tokenData, message) {
 *     // FCM API 호출
 *   }
 * }
 *
 * // OneSignal Provider 구현
 * class OneSignalProvider implements IPushProvider {
 *   readonly name = 'ONESIGNAL';
 *
 *   async sendToToken(tokenData, message) {
 *     // OneSignal API 호출
 *   }
 * }
 * ```
 */
export interface IPushProvider {
  /**
   * Provider 이름
   *
   * 'FCM' | 'ONESIGNAL' | 'APNS' 등
   */
  readonly name: string;

  /**
   * 단일 토큰으로 푸시 발송
   *
   * @param token - FCM 토큰 문자열
   * @param message - 발송할 메시지
   * @returns 발송 결과
   *
   * @example
   * ```typescript
   * // FCM
   * await provider.sendToToken(
   *   'abc123...',
   *   { title: '주문 완료', body: '주문이 완료되었습니다' }
   * );
   * ```
   */
  sendToToken(token: string, message: PushMessage): Promise<PushSendResult>;

  /**
   * 여러 토큰으로 배치 발송
   *
   * @param tokensData - 서비스별 토큰 데이터 배열
   * @param message - 발송할 메시지
   * @returns 각 토큰별 발송 결과 배열
   *
   * @example
   * ```typescript
   * const results = await provider.sendToMultiple(
   *   [
   *     { token: 'abc123...' },
   *     { token: 'def456...' }
   *   ],
   *   { title: '이벤트 알림', body: '신규 이벤트가 시작되었습니다' }
   * );
   * ```
   */
  sendToMultiple(
    tokensData: any[],
    message: PushMessage,
  ): Promise<PushSendResult[]>;

  /**
   * 토큰 유효성 검증
   *
   * @param tokenData - 서비스별 토큰 데이터
   * @returns 유효한 토큰이면 true
   *
   * @example
   * ```typescript
   * const isValid = await provider.validateToken({ token: 'abc123...' });
   * if (!isValid) {
   *   // 토큰 비활성화 처리
   * }
   * ```
   */
  validateToken(tokenData: any): Promise<boolean>;
}
