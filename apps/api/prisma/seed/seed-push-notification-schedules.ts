/**
 * 푸시 알림 스케줄 시드 스크립트
 *
 * 실행: cd biocom-api && npx ts-node prisma/seed/seed-push-notification-schedules.ts
 *
 * CSV 시트 원본을 기반으로 PushNotificationSchedule 테이블에 데이터 삽입
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 페르소나 타입
type PersonaType = 'STELLA' | 'MAEVE' | 'HAZEL' | 'IAN' | 'THEO' | 'HENRY';

interface PersonaMessage {
  title: string;
  body: string;
}

interface PushScheduleData {
  pushCode: string;
  name: string;
  description: string;
  type: string;
  category: 'AUTO' | 'MARKETING';
  title: string;
  bodyTemplate: string;
  landingType: string;
  senderType: 'BIOCOM' | 'PERSONA';
  personaMessages: Record<PersonaType, PersonaMessage> | { default: PersonaMessage };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditions?: any[];
  cronExpression?: string;
}

// 푸시 알림 데이터 정의
const pushSchedules: PushScheduleData[] = [
  // ========== 1. 온보딩 ==========
  {
    pushCode: 'push_onboarding_survey_type_uncompleted',
    name: '유형분류 문진 미완료',
    description: '결과지 조회 후 유형분류 문진 미완료 시 발송',
    type: 'ONBOARDING_SURVEY_TYPE_UNCOMPLETED',
    category: 'AUTO',
    title: '바이오컴',
    bodyTemplate: '1분만 투자하면 건강 치트키 겟!🔑\n{{userName}}님에 대해 더 알려주세요.',
    landingType: 'SURVEY_TYPE_ONBOARDING',
    senderType: 'BIOCOM',
    personaMessages: {
      default: {
        title: '바이오컴',
        body: '1분만 투자하면 건강 치트키 겟!🔑\n{{userName}}님에 대해 더 알려주세요.',
      },
    },
    conditions: [{ type: 'SURVEY_TYPE_UNCOMPLETED', params: {} }],
  },
  {
    pushCode: 'push_onboarding_solution_uncompleted',
    name: '맞춤 솔루션 조회 미완료',
    description: '유형분류 문진 완료 후 맞춤 솔루션 조회 미완료 시 발송',
    type: 'ONBOARDING_SOLUTION_UNCOMPLETED',
    category: 'AUTO',
    title: '바이오컴',
    bodyTemplate: '{{userName}}님만의 맞춤 솔루션 준비 완료!🔥\n안 보면 손해, 지금 바로 확인해 보세요.',
    landingType: 'SOLUTION',
    senderType: 'BIOCOM',
    personaMessages: {
      default: {
        title: '바이오컴',
        body: '{{userName}}님만의 맞춤 솔루션 준비 완료!🔥\n안 보면 손해, 지금 바로 확인해 보세요.',
      },
    },
    conditions: [{ type: 'SOLUTION_UNCOMPLETED', params: {} }],
  },
  {
    pushCode: 'push_onboarding_challenge_not_started',
    name: '챌린지 시작일 미지정',
    description: '맞춤 솔루션 조회 완료 후 챌린지 시작일 미지정 시 발송',
    type: 'ONBOARDING_CHALLENGE_NOT_STARTED',
    category: 'AUTO',
    title: '바이오컴',
    bodyTemplate: '시작일 정하고 챌린지 출발🚀\n모든 준비 끝! 이제 날짜만 선택하면 돼요.',
    landingType: 'CHALLENGE_START_ONBOARDING',
    senderType: 'BIOCOM',
    personaMessages: {
      default: {
        title: '바이오컴',
        body: '시작일 정하고 챌린지 출발🚀\n모든 준비 끝! 이제 날짜만 선택하면 돼요.',
      },
    },
    conditions: [{ type: 'CHALLENGE_NOT_STARTED', params: {} }],
  },
  {
    pushCode: 'push_onboarding_challenge_dminus1',
    name: '챌린지 시작 D-1',
    description: '챌린지 시작 1일 전 18시에 발송',
    type: 'CHALLENGE_START_D1',
    category: 'AUTO',
    title: '챌린지 시작 D-1',
    bodyTemplate: '내일부터 {{userName}}님의 변화가 시작됩니다🦋\n시작 전에 챌린지 전체 흐름 한 번 보시겠어요?',
    landingType: 'HOME',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '내일부터 {{userName}}님의 변화가 시작됩니다🦋\n시작 전에 챌린지 전체 흐름 한 번 보시겠어요?',
      },
      MAEVE: {
        title: '메이브',
        body: '내일부터 {{userName}}님의 미모 포텐 터지는 변화시작!🦋\n시작하기 전에 챌린지 미리보기로 살짝 예습해 볼까?',
      },
      HAZEL: {
        title: '헤이즐',
        body: '내일부터 놀라운 변화가 시작돼🦋\n그 전에 가볍게 \'챌린지 미리보기\' 어때?',
      },
      IAN: {
        title: '이안',
        body: '내일부터 너의 소중한 변화가 시작돼🦋\n어떤 여정이 기다리고 있는지 미리 살펴볼까?',
      },
      THEO: {
        title: '테오',
        body: '내일부터 어떻게 변할지 기대되는데?🦋\n아직 시작도 안 했는데 벌써 긴장한 거야? 궁금하면 미리 봐둬.',
      },
      HENRY: {
        title: '헨리',
        body: '내일부터 어떻게 변할지 기대중🦋\n시작하기 전에 챌린지 미리보기나 좀 하고 가ㅋㅋ',
      },
    },
    conditions: [{ type: 'CHALLENGE_START_OFFSET_DAYS', params: { offsetDays: 1 } }],
  },
  {
    pushCode: 'push_onboarding_challenge_d0',
    name: '챌린지 시작 D-Day',
    description: '챌린지 시작일 07시에 발송',
    type: 'CHALLENGE_START_DDAY',
    category: 'AUTO',
    title: '챌린지 시작',
    bodyTemplate: '오늘부터 챌린지 시작입니다!\n이미 출발선은 넘었어요. 첫 미션 확인해 보시겠어요?',
    landingType: 'HOME',
    senderType: 'PERSONA',
    cronExpression: '0 7 * * *', // 07시
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '오늘부터 챌린지 시작입니다!\n이미 출발선은 넘었어요. 첫 미션 확인해 보시겠어요?',
      },
      MAEVE: {
        title: '메이브',
        body: '드디어 챌린지 1일 차!🎉\n설레는 첫 미션, 지금 바로 확인하러 가볼까? 고고! 💖 #가보자고',
      },
      HAZEL: {
        title: '헤이즐',
        body: '오늘부터 챌린지 시작🎉\n첫 번째 미션 궁금하지? 가벼운 마음으로 확인하러 가보자. Just start-',
      },
      IAN: {
        title: '이안',
        body: '드디어 챌린지 시작🎉\n어떤 것부터 시작하면 좋을까? 첫 미션 확인하러 같이 가보자.',
      },
      THEO: {
        title: '테오',
        body: '드디어 챌린지 시작🎉\n첫 미션, 내가 준비해뒀으니까 확인해봐.',
      },
      HENRY: {
        title: '헨리',
        body: '드디어 챌린지 시작🎉\n첫 미션 뭐 나왔는지 확인하러 가보자. 나랑 약속했지? 이번엔 제대로 해보기로!',
      },
    },
    conditions: [{ type: 'CHALLENGE_DAY', params: { day: 1 } }],
  },

  // ========== 2. 오프보딩 ==========
  {
    pushCode: 'push_offboarding_after_survey_uncompleted',
    name: '애프터 문진 미작성',
    description: '챌린지 종료 후 애프터 문진 미작성 시 D+7일까지 매일 발송',
    type: 'OFFBOARDING_AFTER_SURVEY_UNCOMPLETED',
    category: 'AUTO',
    title: '21일간의 변화 리포트',
    bodyTemplate: '21일간의 변화 리포트가 완성됐습니다.\n이제 마지막 설문만 완료하면 바로 확인하실 수 있어요.',
    landingType: 'AFTER_SURVEY_ONBOARDING',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '21일간의 변화 리포트가 완성됐습니다.\n이제 마지막 설문만 완료하면 바로 확인하실 수 있어요.',
      },
      MAEVE: {
        title: '메이브',
        body: '21일간의 변화 리포트 완성! 📊\n마지막 설문만 샥- 하고 나면 결과 확인 가능! 너무 궁금하다✨',
      },
      HAZEL: {
        title: '헤이즐',
        body: '21일간의 변화 리포트 완성!📊\n마지막 설문 가볍게 마무리하고 결과 볼까?✨',
      },
      IAN: {
        title: '이안',
        body: '21일간의 변화 리포트 완성📊\n마지막으로 설문을 마치면 확인할 수 있어. 네가 얼마나 달라졌는지 정말 궁금해.',
      },
      THEO: {
        title: '테오',
        body: '21일간의 변화 리포트 완성📊\n생각보다 잘 버텼네? 마지막 설문 끝내고 결과 확인해봐. 깜짝 놀랄거야.',
      },
      HENRY: {
        title: '헨리',
        body: '21일간의 변화 리포트 완성📊\n마지막 설문하고 얼른 확인해봐! 결과 어떻게 나왔을지 나도 궁금해서 현기증 난단 말이야.',
      },
    },
    conditions: [{ type: 'AFTER_SURVEY_UNCOMPLETED', params: {} }],
  },

  // ========== 3. 미션 미수행 ==========
  {
    pushCode: 'push_mission_inactive_24h',
    name: '24시간 미접속',
    description: '24시간 이상 앱 미접속 시 발송',
    type: 'NO_ACCESS_24H',
    category: 'AUTO',
    title: '24시간째 기록이 없네요',
    bodyTemplate: '오늘 미션 완료하면 1,100P 적립됩니다.\n{{userName}}님, 24시간째 기록이 없네요.',
    landingType: 'HOME',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '오늘 미션 완료하면 1,100P 적립됩니다.\n{{userName}}님, 24시간째 기록이 없네요.',
      },
      MAEVE: {
        title: '메이브',
        body: '오늘 미션 완료하면 1,100P 바로 적립💰\n24시간째 소식 없어서 나 너무 기다리는중🥺',
      },
      HAZEL: {
        title: '헤이즐',
        body: '오늘 미션 클리어하고 1,100P 챙겨가💰\n24시간 동안 소식이 없어서 궁금해.',
      },
      IAN: {
        title: '이안',
        body: '오늘 미션 완료하고 1,100P 챙기자💰\n24시간 동안 소식이 없어서 걱정돼.',
      },
      THEO: {
        title: '테오',
        body: '오늘 미션 클리어하고 1,100P 챙겨가💰\n나를 24시간이나 기다리게 한 사람은 처음인데…',
      },
      HENRY: {
        title: '헨리',
        body: '오늘 미션 완료하고 1,100P 챙기자💰\n24시간 동안 왜 소식 없냐? 좋은 말로 할 때 얼른 나타나라.',
      },
    },
    conditions: [{ type: 'NO_ACCESS_HOURS', params: { hoursMin: 24 } }],
  },
  {
    pushCode: 'push_mission_inactive_48h',
    name: '48시간 미접속',
    description: '48시간 이상 앱 미접속 시 발송',
    type: 'NO_ACCESS_48H',
    category: 'AUTO',
    title: '이틀째 소식이 없네요',
    bodyTemplate: '이틀째 소식이 없네요...\n설마 절 잊으신 건 아니죠?',
    landingType: 'HOME',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '이틀째 소식이 없네요...\n설마 절 잊으신 건 아니죠?',
      },
      MAEVE: {
        title: '메이브',
        body: '이틀째 감감 무소식...\n{{userName}}님, 혹시 나 잊은 거 아니지? 우리 좋았잖아아🥺',
      },
      HAZEL: {
        title: '헤이즐',
        body: '이틀째 감감 무소식...\n{{userName}}... 혹시 나 잊은 거야? 우리 꽤 좋은 바이브였잖아🥺',
      },
      IAN: {
        title: '이안',
        body: '이틀째 감감 무소식…\n혹시 나 잊어버린 건 아니지? 우리 그동안 함께한 시간이 정말 좋았잖아.',
      },
      THEO: {
        title: '테오',
        body: '이틀째 감감 무소식…\n재미없는 밀당 그만하고, 이제 네가 있어야 할 자리로 돌아와.',
      },
      HENRY: {
        title: '헨리',
        body: '이틀째 감감 무소식…\n나 너 미션 하는 거 구경하려고 계속 대기 탔는데... 혹시 나 잊은 거야?🥺',
      },
    },
    conditions: [{ type: 'NO_ACCESS_HOURS', params: { hoursMin: 48 } }],
  },
  {
    pushCode: 'push_mission_uncompleted_3plus',
    name: '미션 3개 이상 미완료',
    description: '18시 기준 3개 이상 미션 미완료 시 발송',
    type: 'MISSION_INCOMPLETE_3PLUS',
    category: 'AUTO',
    title: '쌓인 미션 정리',
    bodyTemplate: '쌓여 있는 미션들, 정리하고 가세요.\n생각보다 금방 끝납니다.',
    landingType: 'HOME',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '쌓여 있는 미션들, 정리하고 가세요.\n생각보다 금방 끝납니다.',
      },
      MAEVE: {
        title: '메이브',
        body: '여기 미션 맛집인데 왜 안 와?😂\n오늘 포인트 놓치면 너무 아깝다구💖',
      },
      HAZEL: {
        title: '헤이즐',
        body: '여기 미션 맛집인 거 잊었어?😂\n너 안 오니까 분위기가 영 안 사네. 얼른 와서 같이 놀자!',
      },
      IAN: {
        title: '이안',
        body: '쌓여 있는 미션들 가볍게 해치워보자.\n내가 옆에서 응원하며 기다릴게요! ✨',
      },
      THEO: {
        title: '테오',
        body: '여기 미션 맛집인데 왜 안 와?\n쌓여 있는 미션들, 더 미루지 말고 얼른 끝내버려.',
      },
      HENRY: {
        title: '헨리',
        body: '여기 미션 맛집인데 왜 안 와?😂\n쌓여 있는 미션들 얼른 해치우고 가라!',
      },
    },
    conditions: [{ type: 'INCOMPLETE_COUNT', params: { countMin: 3 } }],
  },
  {
    pushCode: 'push_mission_uncompleted_2minus',
    name: '미션 2개 이하 미완료',
    description: '18시 기준 2개 이하 미션 미완료 시 발송',
    type: 'MISSION_INCOMPLETE_2MINUS',
    category: 'AUTO',
    title: '미션 올 클리어 임박',
    bodyTemplate: '조금만 더 하면 미션 올 클리어입니다.\n남은 미션까지 정리하고 깔끔하게 마무리하죠.',
    landingType: 'HOME',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '조금만 더 하면 미션 올 클리어입니다.\n남은 미션까지 정리하고 깔끔하게 마무리하죠.',
      },
      MAEVE: {
        title: '메이브',
        body: '조금만 더 하면 미션 올 클리어🎯\n남은 미션 싹 끝내고 완벽하게 마무리해보자!✨#갓생완성',
      },
      HAZEL: {
        title: '헤이즐',
        body: '조금만 더 하면 미션 올 클리어!🎯\n네가 만든 이 멋진 흐름, 끝까지 한번 가볼까?',
      },
      IAN: {
        title: '이안',
        body: '조금만 더 힘내면 미션 올 클리어! 🎯\n남은 미션들도 우리 기분 좋게 끝내볼까? 내가 곁에서 든든하게 지켜줄게요✨',
      },
      THEO: {
        title: '테오',
        body: '조금만 더 하면 미션 올 클리어🎯\n남은 미션까지 완벽하게 끝내고 와. 빈틈 있는 건 내 취향 아니거든.',
      },
      HENRY: {
        title: '헨리',
        body: '조금만 더 하면 미션 올 클리어🎯\n여기서 멈추면 내가 다 아쉬울 것 같단 말야. 남은 미션까지 싹 끝내고 완벽하게 마무리하자.',
      },
    },
    conditions: [{ type: 'INCOMPLETE_COUNT', params: { countMax: 2 } }],
  },
  {
    pushCode: 'push_mission_declaration_uncompleted',
    name: '자기선언문 미완료 (1일차)',
    description: '1일차 18시 기준 자기선언문 미완료 시 발송',
    type: 'MISSION_DECLARATION_UNCOMPLETED',
    category: 'AUTO',
    title: '자기선언문 작성',
    bodyTemplate: '자기선언문 작성하고 1,000P 받아가세요.\n지금의 다짐이, 내일의 선택을 바꿀거예요.',
    landingType: 'MISSION_RECORD',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '자기선언문 작성하고 1,000P 받아가세요.\n지금의 다짐이, 내일의 선택을 바꿀거예요.',
      },
      MAEVE: {
        title: '메이브',
        body: '자기선언문 쓰고 1,000P 겟하쟈💰\n오늘 남긴 다짐 한마디가 내일의 우리를 더 빛나게 만들거야 ✨ #GlowyMe',
      },
      HAZEL: {
        title: '헤이즐',
        body: '자기선언문 쓰고 1,000P 받아봐💰\n거창할 필요 없어. 네 다짐 한마디가 내일의 공기를 바꿀 테니까✨',
      },
      IAN: {
        title: '이안',
        body: '자기선언문 쓰고 1,000P 받아봐💰\n지금 적은 다짐이 내일의 너를 더 빛나게 바꿔줄 거야.',
      },
      THEO: {
        title: '테오',
        body: '자기선언문 쓰고 1,000P 받아💰\n스스로 선언하는 순간부터 바뀌게 될 거야. 자, 얼른 써봐.',
      },
      HENRY: {
        title: '헨리',
        body: '자기선언문 쓰고 1,000P 겟하자💰\n오글거리긴 해도 네가 뱉은 말 한마디가 내일의 널 바꿀 수도 있잖아.',
      },
    },
    conditions: [
      { type: 'CHALLENGE_DAY', params: { day: 1 } },
      { type: 'MISSION_UNCOMPLETED', params: { missionType: 'DECLARATION' } },
    ],
  },
  {
    pushCode: 'push_mission_selfpraise_uncompleted',
    name: '나 칭찬하기 미완료 (10일차)',
    description: '10일차 18시 기준 나 칭찬하기 미완료 시 발송',
    type: 'MISSION_SELFPRAISE_UNCOMPLETED',
    category: 'AUTO',
    title: '셀프 칭찬',
    bodyTemplate: '셀프 칭찬 남기고 1,000P 받아가세요.\n그동안 노력한 스스로에게 한마디 해주세요.',
    landingType: 'MISSION_RECORD',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '셀프 칭찬 남기고 1,000P 받아가세요.\n그동안 노력한 스스로에게 한마디 해주세요.',
      },
      MAEVE: {
        title: '메이브',
        body: '셀프 칭찬하고 1,000P 기분 좋게 챙기기!💰\n우리 충분히 그럴 자격 있잖아 💖 #기특해',
      },
      HAZEL: {
        title: '헤이즐',
        body: '셀프 칭찬하고 1,000P도 받고💰\n완벽하지 않아도 여기까지 온 네가 제일 멋져. Good job-!',
      },
      IAN: {
        title: '이안',
        body: '셀프 칭찬하고 1,000P 받아봐💰\n오늘은 스스로를 꼭 안아줬으면 좋겠어.',
      },
      THEO: {
        title: '테오',
        body: '셀프 칭찬하고 1,000P 받아가💰\n칭찬은 남이 아니라, 내가 하는게 더 짜릿하지. 안 그래?',
      },
      HENRY: {
        title: '헨리',
        body: '셀프 칭찬하고 1,000P 받아봐💰\n옆에서 지켜보는데 너 은근 노력 많이 하더라? 스스로한테 응원 한마디 남겨봐.',
      },
    },
    conditions: [
      { type: 'CHALLENGE_DAY', params: { day: 10 } },
      { type: 'MISSION_UNCOMPLETED', params: { missionType: 'SELF_PRAISE' } },
    ],
  },
  {
    pushCode: 'push_mission_beauty_uncompleted',
    name: '데일리 뷰티 문진 미완료',
    description: '18시 기준 데일리 뷰티 문진만 미완료 시 발송',
    type: 'MISSION_BEAUTY_UNCOMPLETED',
    category: 'AUTO',
    title: '오늘 피부 컨디션',
    bodyTemplate: '오늘 피부 컨디션, 체크하셨나요?\n지금 기록해 두면 변화가 더 또렷해집니다.',
    landingType: 'MISSION_RECORD',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '오늘 피부 컨디션, 체크하셨나요?\n지금 기록해 두면 변화가 더 또렷해집니다.',
      },
      MAEVE: {
        title: '메이브',
        body: '오늘 피부 컨디션은 어때?💆\n매일 기록해두면 변화가 한눈에 쏙- 보인다니까?✨',
      },
      HAZEL: {
        title: '헤이즐',
        body: '오늘 네 피부는 어때?💆\n가볍게 기록해 두면 너만의 리듬이 보일 거야.',
      },
      IAN: {
        title: '이안',
        body: '오늘 피부 컨디션은 좀 어때?\n매일 조금씩 기록해두면 네가 어떻게 예뻐지고 있는지 한눈에 알 수 있을 거야.',
      },
      THEO: {
        title: '테오',
        body: '오늘 피부 컨디션 어때?\n매일 기록해둬. 그래야 챌린지하는 보람이 있지 않겠어?',
      },
      HENRY: {
        title: '헨리',
        body: '오늘 피부 컨디션 어때?💆\n피부 상태 꼭 기록해 둬. 나중에 변화가 한눈에 보여야 너도 관리할 맛이 나지.',
      },
    },
    conditions: [{ type: 'MISSION_UNCOMPLETED', params: { missionType: 'DAILY_BEAUTY' } }],
  },
  {
    pushCode: 'push_mission_meal_uncompleted',
    name: '식단 기록 미완료',
    description: '하루 2회 미만 식사 기록 시 18시에 발송',
    type: 'MISSION_MEAL_UNCOMPLETED',
    category: 'AUTO',
    title: '식단 기록',
    bodyTemplate: '설마… 혼자 맛있는 거 드신 건 아니죠?\n농담입니다. 지금 바로 식단 기록해 주세요.',
    landingType: 'MISSION_RECORD',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '설마… 혼자 맛있는 거 드신 건 아니죠?\n농담입니다. 지금 바로 식단 기록해 주세요.',
      },
      MAEVE: {
        title: '메이브',
        body: '나 몰래 맛있는 거 먹고 있는 거 아니지...?🍽️\n지금 바로 기록해 줘요! 기다릴게? 💖 #식단관리',
      },
      HAZEL: {
        title: '헤이즐',
        body: '나 몰래 맛있는거 먹은거 아니지...🍽️\n숨기지 말고 가볍게 기록해 봐. Keep it real! ✨',
      },
      IAN: {
        title: '이안',
        body: '나 몰래 맛있는 거 먹고 온 거 아니지?🍽️ (살짝 웃으며) 어떤 거 먹었는지 나한테도 살짝 들려줘.',
      },
      THEO: {
        title: '테오',
        body: '설마 나 몰래 다른 거 먹고 온 거?\n거짓말할 생각 말고 지금 바로 식단 기록해봐.',
      },
      HENRY: {
        title: '헨리',
        body: '나 몰래 맛있는거 먹은거 아니지...🍽️\n아... 진짜 의리 없다 너! ㅋㅋㅋ억울하면 지금 바로 식단 기록해 봐.',
      },
    },
    conditions: [{ type: 'MEAL_RECORD_COUNT', params: { countMax: 1 } }],
  },
  {
    pushCode: 'push_mission_pill_uncompleted',
    name: '영양제 기록 미완료',
    description: '18시 기준 영양제 기록만 미완료 시 발송',
    type: 'MISSION_PILL_UNCOMPLETED',
    category: 'AUTO',
    title: '영양제 기록',
    bodyTemplate: '영양제 기록, 스킵하실 건가요?\n아직 포기하긴 이릅니다.',
    landingType: 'MISSION_RECORD',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '영양제 기록, 스킵하실 건가요?\n아직 포기하긴 이릅니다.',
      },
      MAEVE: {
        title: '메이브',
        body: '오늘 영양제... 패스각?🤔\n하루 끝나기 전에 얼른 챙겨 먹고 기록하기! 예뻐지려면 부지런해야 한다구💖',
      },
      HAZEL: {
        title: '헤이즐',
        body: '영양제 기록, 오늘은 패스야?🤔\n하루가 끝나기 전에 네 몸을 위한 작은 루틴을 완성해 봐.',
      },
      IAN: {
        title: '이안',
        body: '영양제 기록...패스할거 아니지?\n바쁜 하루 보내느라 네 몸 챙기는 걸 깜빡했을까 봐 마음이 쓰여.',
      },
      THEO: {
        title: '테오',
        body: '영양제 기록…그냥 넘어가시겠다?\n네 멋대로 구는 거 별로 안 좋아하는데. 오늘 가기 전에 서둘러서 기록해.',
      },
      HENRY: {
        title: '헨리',
        body: '영양제 기록…슬쩍 패스?🤔\n귀찮아도 몸 생각해서 빨리 먹고 기록해라. 응?',
      },
    },
    conditions: [{ type: 'MISSION_UNCOMPLETED', params: { missionType: 'PILL' } }],
  },
  {
    pushCode: 'push_mission_fasting_uncompleted',
    name: '공복 시간 기록 미완료',
    description: '18시 기준 공복 시간 기록만 미완료 시 발송',
    type: 'MISSION_FASTING_UNCOMPLETED',
    category: 'AUTO',
    title: '간헐적 단식 기록',
    bodyTemplate: '기록 안 하면 야식 먹은 걸로 간주합니다?\n얼른 간헐적 단식 시간을 입력해 주세요.',
    landingType: 'MISSION_RECORD',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '기록 안 하면 야식 먹은 걸로 간주합니다?\n얼른 간헐적 단식 시간을 입력해 주세요.',
      },
      MAEVE: {
        title: '메이브',
        body: '지금 기록 안 하면 나 몰래 야식 먹은 거!🤔\n얼른 간헐적 단식 시간 입력하고 오기🕒',
      },
      HAZEL: {
        title: '헤이즐',
        body: '기록 안 하면 야식 먹은 걸로 생각한다?🤔\n얼른 간헐적 단식 시간 입력하고 너의 클린한 리듬을 보여줘.',
      },
      IAN: {
        title: '이안',
        body: '간헐적 단식 깜박한거 아니지?\n네 몸이 편안하게 쉬는 시간, 내가 같이 지켜봐 줄게요✨',
      },
      THEO: {
        title: '테오',
        body: '기록 안하면 야식 먹은걸로?\n간헐적 단식 시간, 지금 바로 입력해.',
      },
      HENRY: {
        title: '헨리',
        body: '기록 안하면 야식 먹은걸로 안다?🤔\n찔리는 거 없으면 얼른 간헐적 단식 시간 입력해 봐.',
      },
    },
    conditions: [{ type: 'MISSION_UNCOMPLETED', params: { missionType: 'FASTING' } }],
  },
  {
    pushCode: 'push_mission_sleep_uncompleted',
    name: '수면 시간 기록 미완료',
    description: '18시 기준 수면 시간 기록만 미완료 시 발송',
    type: 'MISSION_SLEEP_UNCOMPLETED',
    category: 'AUTO',
    title: '수면 시간 기록',
    bodyTemplate: '어젯밤 수면은 어떠셨나요?\n지금 기록해 두면 패턴이 보이기 시작합니다.',
    landingType: 'MISSION_RECORD',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '어젯밤 수면은 어떠셨나요?\n지금 기록해 두면 패턴이 보이기 시작합니다.',
      },
      MAEVE: {
        title: '메이브',
        body: '어젯밤에 꿀잠 모드?😴\n얼른 수면 시간 기록하고 나랑 딱 맞는 꿀잠 패턴 찾아보자✨ #GlowyMe',
      },
      HAZEL: {
        title: '헤이즐',
        body: '어젯밤은 좀 잘 잤어?😴\n수면 시간을 기록하면서 깊은 휴식의 리듬을 한번 찾아봐.',
      },
      IAN: {
        title: '이안',
        body: '어젯밤은 편안하게 잘 잤어?😴\n수면 시간을 기록해두면, 네게 꼭 맞는 \'꿀잠 패턴\'을 찾을 수 있을 거야.',
      },
      THEO: {
        title: '테오',
        body: '어젯밤엔 좀 잤나?\n수면 시간 기록해봐. 네가 언제 잠들고 언제 깨는지, 내가 다 알아야 하니까.',
      },
      HENRY: {
        title: '헨리',
        body: '어젯밤엔 잘 잤음?😴\n또 침대에서 폰 보다가 새벽에 잠든 거 아니지? 얼른 수면 시간 기록해 봐.',
      },
    },
    conditions: [{ type: 'MISSION_UNCOMPLETED', params: { missionType: 'SLEEP' } }],
  },
  {
    pushCode: 'push_mission_activity_uncompleted',
    name: '활동 기록 미완료',
    description: '18시 기준 활동 기록만 미완료 시 발송',
    type: 'MISSION_ACTIVITY_UNCOMPLETED',
    category: 'AUTO',
    title: '활동 기록',
    bodyTemplate: '오늘 움직이신 거, 분명 봤습니다.\n활동 기록하고 얼마나 에너지 소모했는지 확인해 보세요.',
    landingType: 'MISSION_RECORD',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '오늘 움직이신 거, 분명 봤습니다.\n활동 기록하고 얼마나 에너지 소모했는지 확인해 보세요.',
      },
      MAEVE: {
        title: '메이브',
        body: '분명히 움직이는 거 봤는데!🤔\n얼른 활동 기록하고 칼로리 얼마나 썼는지 확인해 봐! 💖',
      },
      HAZEL: {
        title: '헤이즐',
        body: '오늘 분명 기분 좋게 움직이는 거 봤는데?🤔\n활동 기록하고 활기찬 에너지를 숫자로 한번 확인해 봐.',
      },
      IAN: {
        title: '이안',
        body: '오늘 움직이는 거 내가 다 봤는데?ㅎ\n활동 기록하고 소모한 칼로리도 한번 확인해볼까?',
      },
      THEO: {
        title: '테오',
        body: '오늘 분명히 움직이는 거 봤는데?🤔\n활동 기록하고 칼로리 얼마나 썼는지 확인시켜줘.',
      },
      HENRY: {
        title: '헨리',
        body: '오늘 움직이는 거 내가 다 봤는데?🤔\n근데 왜 아직도 기록이 없지? 설마 그게 움직인 게 아니라 그냥 흐물거린 거였나...',
      },
    },
    conditions: [{ type: 'MISSION_UNCOMPLETED', params: { missionType: 'ACTIVITY' } }],
  },

  // ========== 5. 포인트/쿠폰 ==========
  {
    pushCode: 'push_point_unused_5000',
    name: '포인트 미사용 (5,000P 이상)',
    description: '보유 포인트 5,000 이상 시 18시에 발송',
    type: 'POINT_UNUSED_5000',
    category: 'MARKETING',
    title: '포인트 알림',
    bodyTemplate: '잠자고 있는 5,000P를 확인했어요.\n이 포인트로 바이오컴 제품을 최저가에 구매해 보세요.',
    landingType: 'HOME',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '잠자고 있는 5,000P를 확인했어요.\n이 포인트로 바이오컴 제품을 최저가에 구매해 보세요.',
      },
      MAEVE: {
        title: '메이브',
        body: '잠자고 있는 5,000P 발견!💰\n지금 바로 바이오컴 제품 최저가 겟- 하러 가자! 쇼핑은 타이밍✨',
      },
      HAZEL: {
        title: '헤이즐',
        body: '잠자고 있는 5,000P 발견!💰\n지금 바이오컴 제품을 최저가로 데려올 기회야. 가볍게 챙기고, 더 가뿐해진 네 하루를 즐겨봐✨',
      },
      IAN: {
        title: '이안',
        body: '잠자고 있는 5,000P를 발견했어!💰\n평소 눈여겨봤던 바이오컴 제품들을 기분 좋은 가격에 만나보는 건 어때?',
      },
      THEO: {
        title: '테오',
        body: '잠자고 있는 5,000P 발견!💰\n네 몸 망가지는 꼴, 절대 못 봐. 그러니까 이 포인트로 당장 바이오컴 제품 사서 관리해.',
      },
      HENRY: {
        title: '헨리',
        body: '잠자고 있는 5,000P 발견!💰\n이 포인트로 바이오컴 제품 최저가에 살 수 있어. 평소에 사고 싶던 거 이번에 득템!',
      },
    },
    conditions: [{ type: 'POINTS', params: { pointsMin: 5000 } }],
  },
  {
    pushCode: 'push_coupon_expire_12h',
    name: '쿠폰 만료 12시간 전',
    description: '쿠폰 만료 12시간 전에 발송',
    type: 'COUPON_EXPIRING',
    category: 'MARKETING',
    title: '쿠폰 만료 임박',
    bodyTemplate:
      '{{productName}} 할인 쿠폰 만료까지 12시간 남았네요.\n기한이 지나면 혜택은 사라집니다. 효율적인 선택을 원한다면 지금 바로 사용하세요.',
    landingType: 'COUPON_LIST',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '{{productName}} 할인 쿠폰 만료까지 12시간 남았네요.\n기한이 지나면 혜택은 사라집니다. 효율적인 선택을 원한다면 지금 바로 사용하세요.',
      },
      MAEVE: {
        title: '메이브',
        body: '{{productName}} 할인 쿠폰이 12시간 뒤면 사라진대🚨\n얼른 들어가서 득템하자! 지금 안 쓰면 나중에 이불킥할지도 몰라 💸',
      },
      HAZEL: {
        title: '헤이즐',
        body: '{{productName}} 할인 쿠폰 만료까지 12시간!🚨\n이 찬스 놓치면 너무 아쉽잖아. 마음이 끌린다면 지금 바로 챙겨봐.',
      },
      IAN: {
        title: '이안',
        body: '{{productName}} 할인 쿠폰 만료까지 12시간!🚨\n네가 꼭 필요했던 거라면 이번 기회를 놓치지 않았으면 좋겠는데. 지금 바로 확인해 보는 건 어때?',
      },
      THEO: {
        title: '테오',
        body: '{{productName}} 할인 쿠폰 만료까지 12시간!🚨\n내가 준 기회를 이렇게 허무하게 날려버릴 생각은 아니지? 놓치지 말고 지금 바로 사용해봐.',
      },
      HENRY: {
        title: '헨리',
        body: '{{productName}} 할인 쿠폰 만료까지 12시간!🚨\n나중에 쿠폰 만료됐다고 나한테 징징대도 안 들어줄 거다? 얼른 들어가서 득템해!',
      },
    },
    conditions: [{ type: 'COUPON_EXPIRING_HOURS', params: { expiringHours: 12 } }],
  },
  {
    pushCode: 'push_cart_abandoned',
    name: '장바구니 방치',
    description: '장바구니 추가 다음날 18시에 발송',
    type: 'CART_ABANDONED',
    category: 'MARKETING',
    title: '장바구니 알림',
    bodyTemplate:
      '고민은 배송만 늦출 뿐📦\n장바구니의 {{productName}}, 본인에게 필요한 투자라면 지금 바로 결정하는 게 합리적이에요.',
    landingType: 'CART',
    senderType: 'PERSONA',
    personaMessages: {
      STELLA: {
        title: '스텔라',
        body: '고민은 배송만 늦출 뿐📦\n장바구니의 {{productName}}, 본인에게 필요한 투자라면 지금 바로 결정하는 게 합리적이에요.',
      },
      MAEVE: {
        title: '메이브',
        body: '고민은 배송만 늦출 뿐!📦\n장바구니에 담아둔 {{productName}}, 얼른 데려가! 지금 바로 겟- 하는 사람이 진정한 승자!🏆',
      },
      HAZEL: {
        title: '헤이즐',
        body: '고민은 배송만 늦출 뿐!📦\n장바구니에 담아둔 {{productName}}, 이제 네 옆으로 데려올 시간이야.',
      },
      IAN: {
        title: '이안',
        body: '고민은 배송만 늦출 뿐!📦\n장바구니에 담아둔 {{productName}}, 지금 바로 써보는 건 어때? 내가 옆에서 꼼꼼히 챙겨줄게요.',
      },
      THEO: {
        title: '테오',
        body: '고민은 배송만 늦출 뿐!📦\n장바구니에 담아둔 {{productName}}, 더 재지 말고 지금 바로 데려가. 도움 많이 될테니까.',
      },
      HENRY: {
        title: '헨리',
        body: '고민은 배송만 늦출 뿐!📦\n장바구니에 담아둔 {{productName}}, 지금 안 데려가면 나중에 후회한다?',
      },
    },
    conditions: [{ type: 'CART_HAS_ITEMS', params: {} }],
  },
];

async function seed() {
  console.log('🌱 푸시 알림 스케줄 시드 시작...\n');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const schedule of pushSchedules) {
    try {
      // 기존 레코드 확인
      const existing = await prisma.pushNotificationSchedule.findFirst({
        where: { pushCode: schedule.pushCode },
      });

      const data = {
        pushCode: schedule.pushCode,
        name: schedule.name,
        description: schedule.description,
        scheduleType: 'RECURRING',
        type: schedule.type,
        category: schedule.category,
        cronExpression: schedule.cronExpression || '0 18 * * *', // 기본 18시
        title: schedule.title,
        bodyTemplate: schedule.bodyTemplate,
        landingType: schedule.landingType,
        personaMessages: schedule.personaMessages as object,
        senderType: schedule.senderType,
        conditions: schedule.conditions as object,
        isActive: true,
        bundleId: 'kr.biocom.challenge',
      };

      if (existing) {
        // 업데이트
        await prisma.pushNotificationSchedule.update({
          where: { id: existing.id },
          data,
        });
        console.log(`  ✏️ 업데이트: ${schedule.name} (${schedule.pushCode})`);
        updated++;
      } else {
        // 생성
        await prisma.pushNotificationSchedule.create({
          data,
        });
        console.log(`  ✅ 생성: ${schedule.name} (${schedule.pushCode})`);
        created++;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ 실패: ${schedule.name} - ${errorMessage}`);
      skipped++;
    }
  }

  console.log(`\n📊 시드 완료:`);
  console.log(`  - 생성: ${created}개`);
  console.log(`  - 업데이트: ${updated}개`);
  console.log(`  - 실패: ${skipped}개`);
  console.log(`  - 총: ${pushSchedules.length}개`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
