/**
 * JWT 페이로드 인터페이스
 * JWT 토큰에 포함되는 정보를 정의
 */
export interface JwtPayload {
  /**
   * Subject (사용자 ID)
   */
  sub: number;

  /**
   * 사용자 이름
   */
  name: string;

  /**
   * 발급 시간 (자동 생성)
   */
  iat?: number;

  /**
   * 만료 시간 (자동 생성)
   */
  exp?: number;
}