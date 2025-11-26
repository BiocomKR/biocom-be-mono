/**
 * JWT 페이로드 인터페이스
 * JWT 토큰에 포함되는 정보를 정의 (운영자용)
 */
export interface JwtPayload {
  /**
   * Subject (운영자 ID)
   */
  sub: number;

  /**
   * 운영자 이름
   */
  name: string;

  /**
   * 접근 등급
   * @see AccessTier enum in prisma schema
   */
  accessTier: 'SYSTEM' | 'MANAGER' | 'STAFF' | 'VIEWER';

  /**
   * 발급 시간 (자동 생성)
   */
  iat?: number;

  /**
   * 만료 시간 (자동 생성)
   */
  exp?: number;
}