/**
 * 사용자 구독 상태 열거형
 * 사용자의 현재 구독/챌린지 상태를 나타냄
 */
export enum UserSubscriptionStatus {
  /**
   * 신규회원 - 결제를 하지 않은 일반 회원
   * 제한적 기능 접근 가능
   */
  NEWCOMER = 'newcomer',
  
  /**
   * 챌린지 활성화 회원 - 21일 챌린지 진행 중인 회원
   * 모든 챌린지 기능 + 일반 기능 접근 가능
   */
  CHALLENGE_ACTIVE = 'challenge_active',
  
  /**
   * 구독 회원 - 월구독 중인 회원
   * 대부분 기능 해금 (단, 설문조사 등 챌린지 전용 기능 제외)
   */
  SUBSCRIBER = 'subscriber'
}

/**
 * 사용자 상태별 권한 매트릭스
 */
export const USER_PERMISSION_MATRIX = {
  [UserSubscriptionStatus.NEWCOMER]: {
    // 정책서의 "구매 전" 정책 적용
    홈_유형분류: false,
    홈_결과지: true,
    홈_맞춤솔루션: false,
    컨텐츠_강의: false, // 미리보기만
    컨텐츠_홈트: false, // 미리보기만
    컨텐츠_칼럼: true,
    기록_전체: false,
    놀이터_전체: false,
    쇼핑_전체: true,
    마이페이지_기본: true,
  },
  
  [UserSubscriptionStatus.CHALLENGE_ACTIVE]: {
    // 모든 기능 접근 가능
    홈_전체: true,
    컨텐츠_전체: true,
    기록_전체: true,
    놀이터_전체: true,
    쇼핑_전체: true,
    마이페이지_전체: true,
    설문조사: true, // 챌린지 전용
  },
  
  [UserSubscriptionStatus.SUBSCRIBER]: {
    // 대부분 기능 해금 (챌린지 전용 제외)
    홈_전체: true,
    컨텐츠_전체: true,
    기록_대부분: true, // 챌린지 전용 기록 제외
    놀이터_대부분: true,
    쇼핑_전체: true,
    마이페이지_전체: true,
    설문조사: false, // 챌린지 전용이므로 불가
  }
};

/**
 * 상태 전환 가능 여부 체크
 */
export const canTransitionTo = (
  from: UserSubscriptionStatus,
  to: UserSubscriptionStatus
): boolean => {
  const transitions = {
    [UserSubscriptionStatus.NEWCOMER]: [
      UserSubscriptionStatus.CHALLENGE_ACTIVE,
      UserSubscriptionStatus.SUBSCRIBER
    ],
    [UserSubscriptionStatus.CHALLENGE_ACTIVE]: [
      UserSubscriptionStatus.NEWCOMER, // 챌린지 완료 후
      UserSubscriptionStatus.SUBSCRIBER // 병행 가능
    ],
    [UserSubscriptionStatus.SUBSCRIBER]: [
      UserSubscriptionStatus.NEWCOMER, // 구독 만료
      UserSubscriptionStatus.CHALLENGE_ACTIVE // 챌린지 구매 시
    ]
  };
  
  return transitions[from]?.includes(to) ?? false;
};