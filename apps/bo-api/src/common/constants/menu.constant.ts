/**
 * 메뉴 코드 상수
 * 백오피스 메뉴 권한 관리용
 *
 * @see MenuCode enum in prisma schema
 */
export const MENU = {
  DASHBOARD: 'DASHBOARD',
  USERS: 'USERS',
  CHALLENGE: 'CHALLENGE',
  MISSION: 'MISSION',
  SURVEY: 'SURVEY',
  QUIZ: 'QUIZ',
  CONTENT: 'CONTENT',
  POINT: 'POINT',
  SHOP: 'SHOP',
  ORDERS: 'ORDERS',
  SHIPPING: 'SHIPPING',
  REFUNDS: 'REFUNDS',
  PUSH: 'PUSH',
  OPERATORS: 'OPERATORS', // SYSTEM 전용
} as const;

export type MenuCode = (typeof MENU)[keyof typeof MENU];

/**
 * 메뉴 코드별 설명
 */
export const MENU_LABELS: Record<MenuCode, string> = {
  DASHBOARD: '대시보드',
  USERS: '사용자 관리',
  CHALLENGE: '챌린지 관리',
  MISSION: '미션 관리',
  SURVEY: '설문 관리',
  QUIZ: '퀴즈 관리',
  CONTENT: '콘텐츠 관리',
  POINT: '포인트 관리',
  SHOP: '상품 관리',
  ORDERS: '주문 관리',
  SHIPPING: '배송 관리',
  REFUNDS: '환불 관리',
  PUSH: '푸시 알림 관리',
  OPERATORS: '운영자 관리',
};
