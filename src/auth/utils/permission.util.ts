/**
 * 권한 검증 유틸리티
 * 운영자의 메뉴 접근 권한 및 쓰기 권한을 검증
 */

// AccessTier 레벨 (낮을수록 높은 권한)
const TIER_LEVEL: Record<string, number> = {
  SYSTEM: 0,
  MANAGER: 1,
  STAFF: 2,
  VIEWER: 3,
};

type AccessTier = 'SYSTEM' | 'MANAGER' | 'STAFF' | 'VIEWER';
type MenuCode =
  | 'DASHBOARD'
  | 'USERS'
  | 'CHALLENGE'
  | 'MISSION'
  | 'SURVEY'
  | 'QUIZ'
  | 'CONTENT'
  | 'POINT'
  | 'SHOP'
  | 'ORDERS'
  | 'SHIPPING'
  | 'REFUNDS'
  | 'PUSH'
  | 'OPERATORS';

interface OperatorWithDepartment {
  accessTier: AccessTier;
  department?: {
    menuCodes: MenuCode[];
  } | null;
}

/**
 * 메뉴 접근 권한 확인
 *
 * @param operator 운영자 정보 (accessTier, department 포함)
 * @param menuCode 접근하려는 메뉴 코드
 * @returns 접근 가능 여부
 */
export function canAccessMenu(
  operator: OperatorWithDepartment,
  menuCode: MenuCode,
): boolean {
  // 운영자 관리는 SYSTEM만 가능
  if (menuCode === 'OPERATORS') {
    return operator.accessTier === 'SYSTEM';
  }

  // SYSTEM, MANAGER는 모든 메뉴 접근 가능
  if (['SYSTEM', 'MANAGER'].includes(operator.accessTier)) {
    return true;
  }

  // STAFF, VIEWER는 소속 부서 메뉴만
  return operator.department?.menuCodes?.includes(menuCode) ?? false;
}

/**
 * 쓰기 권한 확인
 * VIEWER는 읽기 전용
 *
 * @param operator 운영자 정보
 * @returns 쓰기 가능 여부
 */
export function canWrite(operator: OperatorWithDepartment): boolean {
  return operator.accessTier !== 'VIEWER';
}

/**
 * 특정 등급 이상인지 확인
 *
 * @param operator 운영자 정보
 * @param requiredTier 요구되는 최소 등급
 * @returns 요구 등급 이상인지 여부
 */
export function hasMinimumTier(
  operator: OperatorWithDepartment,
  requiredTier: AccessTier,
): boolean {
  return TIER_LEVEL[operator.accessTier] <= TIER_LEVEL[requiredTier];
}

/**
 * SYSTEM 등급인지 확인
 *
 * @param operator 운영자 정보
 * @returns SYSTEM 등급 여부
 */
export function isSystem(operator: OperatorWithDepartment): boolean {
  return operator.accessTier === 'SYSTEM';
}

/**
 * MANAGER 이상 등급인지 확인
 *
 * @param operator 운영자 정보
 * @returns MANAGER 이상 여부
 */
export function isManagerOrAbove(operator: OperatorWithDepartment): boolean {
  return hasMinimumTier(operator, 'MANAGER');
}
