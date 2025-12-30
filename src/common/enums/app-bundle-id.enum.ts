/**
 * 앱 번들 ID (패키지명) enum
 * iOS: Bundle Identifier, Android: Application ID
 */
export enum AppBundleId {
  // 챌린지 앱 - 운영
  CHALLENGE_PROD = 'kr.biocom.challenge',
  // 챌린지 앱 - 개발
  CHALLENGE_DEV = 'kr.biocom.challenge.dev',
}

// 번들 ID 라벨
export const APP_BUNDLE_ID_LABELS: Record<AppBundleId, string> = {
  [AppBundleId.CHALLENGE_PROD]: '챌린지 (운영)',
  [AppBundleId.CHALLENGE_DEV]: '챌린지 (개발)',
};
