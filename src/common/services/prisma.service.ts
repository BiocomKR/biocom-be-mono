import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CryptoUtil } from '../utils/crypto.util';

// 싱글톤 인스턴스
let prismaInstance: any = null;

/**
 * Date 객체를 KST로 변환 (읽기 시)
 */
function convertToKST(date: Date | null): Date | null {
  if (!date || !(date instanceof Date)) return date;
  return new Date(date.getTime() + (9 * 60 * 60 * 1000));
}

/**
 * Date 객체를 UTC로 변환 (저장 시)
 */
function convertToUTC(date: Date | string | null): Date | null {
  if (!date) return null;
  if (typeof date === 'string') date = new Date(date);
  if (!(date instanceof Date)) return null;
  return new Date(date.getTime() - (9 * 60 * 60 * 1000));
}

/**
 * 객체 내의 모든 Date 필드를 KST로 변환
 */
function convertDatesToKST<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return convertToKST(obj) as any;
  if (Array.isArray(obj)) return obj.map(item => convertDatesToKST(item)) as any;
  
  const converted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date) {
      converted[key] = convertToKST(value);
    } else if (value && typeof value === 'object') {
      converted[key] = convertDatesToKST(value);
    } else {
      converted[key] = value;
    }
  }
  return converted;
}

/**
 * 객체 내의 모든 Date 필드를 UTC로 변환
 */
function convertDatesToUTC<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date || typeof obj === 'string') return convertToUTC(obj) as any;
  if (Array.isArray(obj)) return obj.map(item => convertDatesToUTC(item)) as any;
  
  const converted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date || (typeof value === 'string' && isDateString(value))) {
      converted[key] = convertToUTC(value);
    } else if (value && typeof value === 'object') {
      converted[key] = convertDatesToUTC(value);
    } else {
      converted[key] = value;
    }
  }
  return converted;
}

/**
 * 문자열이 날짜 형식인지 확인
 */
function isDateString(str: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(str)) {
    const date = new Date(str);
    return !isNaN(date.getTime());
  }
  return false;
}

/**
 * Prisma Client Extension으로 암호화 및 시간대 변환 기능 추가
 */
function createExtendedPrismaClient() {
  // 이미 인스턴스가 있으면 재사용
  if (prismaInstance) {
    return prismaInstance;
  }
  
  const logger = new Logger('PrismaExtension');
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  }).$extends({
    // 조회 시 자동 복호화
    result: {
      user: {
        name: {
          needs: { name: true },
          compute(user) {
            return user.name ? CryptoUtil.decrypt(user.name) : user.name;
          },
        },
        mobile: {
          needs: { mobile: true },
          compute(user) {
            return user.mobile ? CryptoUtil.decrypt(user.mobile) : user.mobile;
          },
        },
      },
    },
    // 생성/수정 시 자동 암호화 및 시간대 변환
    query: {
      // 모든 모델에 대한 시간대 변환
      $allModels: {
        // 생성 시 KST → UTC 변환 (한국 서비스이므로 비활성화)
        async create({ args, query, model }) {
          // if (args.data) {
          //   args.data = convertDatesToUTC(args.data);
          // }
          const result = await query(args);
          // return convertDatesToKST(result);
          return result;
        },
        
        // 다중 생성 시 KST → UTC 변환
        async createMany({ args, query, model }) {
          if (args.data) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map(item => convertDatesToUTC(item));
            } else {
              args.data = convertDatesToUTC(args.data);
            }
          }
          return query(args);
        },
        
        // 업데이트 시 KST → UTC 변환 (한국 서비스이므로 비활성화)
        async update({ args, query, model }) {
          // if (args.data) {
          //   args.data = convertDatesToUTC(args.data);
          // }
          const result = await query(args);
          // return convertDatesToKST(result);
          return result;
        },
        
        // 다중 업데이트 시 KST → UTC 변환
        async updateMany({ args, query, model }) {
          if (args.data) {
            args.data = convertDatesToUTC(args.data);
          }
          return query(args);
        },
        
        // 조회 시 UTC → KST 변환 (비활성화)
        async findUnique({ args, query, model }) {
          const result = await query(args);
          // return result ? convertDatesToKST(result) : result;
          return result;
        },

        // 첫 번째 조회 시 UTC → KST 변환 (비활성화)
        async findFirst({ args, query, model }) {
          const result = await query(args);
          // return result ? convertDatesToKST(result) : result;
          return result;
        },

        // 다중 조회 시 UTC → KST 변환 (비활성화)
        async findMany({ args, query, model }) {
          const results = await query(args);
          // return results.map(result => convertDatesToKST(result));
          return results;
        },
        
        // Upsert 시 KST → UTC 변환 (비활성화)
        async upsert({ args, query, model }) {
          // if (args.create) {
          //   args.create = convertDatesToUTC(args.create);
          // }
          // if (args.update) {
          //   args.update = convertDatesToUTC(args.update);
          // }
          const result = await query(args);
          // return convertDatesToKST(result);
          return result;
        },
      },
      
      // User 모델의 암호화 처리 (기존 코드 유지)
      user: {
        async create({ args, query }) {
          // name 암호화
          if (args.data.name && typeof args.data.name === 'string') {
            args.data.name = CryptoUtil.encrypt(args.data.name);
          }
          // mobile 암호화
          if (args.data.mobile && typeof args.data.mobile === 'string') {
            args.data.mobile = CryptoUtil.encrypt(args.data.mobile);
          }
          return query(args);
        },
        async createMany({ args, query }) {
          // createMany의 경우 data 배열 처리
          if (Array.isArray(args.data)) {
            args.data = args.data.map(item => ({
              ...item,
              name: item.name ? CryptoUtil.encrypt(item.name) : item.name,
              mobile: item.mobile ? CryptoUtil.encrypt(item.mobile) : item.mobile,
            }));
          } else if (args.data) {
            // 단일 객체인 경우
            if (args.data.name) args.data.name = CryptoUtil.encrypt(args.data.name);
            if (args.data.mobile) args.data.mobile = CryptoUtil.encrypt(args.data.mobile);
          }
          return query(args);
        },
        async update({ args, query }) {
          // update의 data 암호화
          if (args.data.name && typeof args.data.name === 'string') {
            args.data.name = CryptoUtil.encrypt(args.data.name);
          }
          if (args.data.mobile && typeof args.data.mobile === 'string') {
            args.data.mobile = CryptoUtil.encrypt(args.data.mobile);
          }
          return query(args);
        },
        async updateMany({ args, query }) {
          // updateMany의 data 암호화
          if (args.data.name && typeof args.data.name === 'string') {
            args.data.name = CryptoUtil.encrypt(args.data.name);
          }
          if (args.data.mobile && typeof args.data.mobile === 'string') {
            args.data.mobile = CryptoUtil.encrypt(args.data.mobile);
          }
          return query(args);
        },
      },
    },
  });

  // 싱글톤 인스턴스 저장
  prismaInstance = prisma;
  return prisma;
}

/**
 * Prisma 서비스 클래스
 * 데이터베이스 연결 및 트랜잭션 관리를 담당하는 핵심 서비스
 * 
 * 주요 기능:
 * - PostgreSQL 데이터베이스 연결 관리
 * - 애플리케이션 시작/종료 시 자동 연결/해제
 * - 구조화된 로깅을 통한 데이터베이스 작업 추적
 * - 트랜잭션 지원
 * - 개인정보(이름, 휴대폰번호) 자동 암/복호화
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private prisma: any;

  constructor() {
    this.prisma = createExtendedPrismaClient();
    
    // Prisma Middleware로 시간대 자동 변환 추가
    this.setupTimezoneMiddleware();
    
    // PrismaClient의 모든 속성을 PrismaService에 바인딩
    const delegateProperties = Object.keys(this.prisma).filter(
      key => !['$on', '$connect', '$disconnect', '$use', '$transaction', '$executeRaw', '$queryRaw'].includes(key)
    );
    
    for (const prop of delegateProperties) {
      Object.defineProperty(this, prop, {
        get: () => (this.prisma as any)[prop],
      });
    }
  }

  // PrismaClient의 주요 메서드들을 명시적으로 노출
  get user() { return this.prisma.user; }
  get refreshToken() { return this.prisma.refreshToken; }
  get fileUpload() { return this.prisma.fileUpload; }
  get imwebInfo() { return this.prisma.imwebInfo; }
  get survey() { return this.prisma.survey; }
  get surveyQuestion() { return this.prisma.surveyQuestion; }
  get surveyOption() { return this.prisma.surveyOption; }
  get surveyAnswer() { return this.prisma.surveyAnswer; }
  get categoryDetail() { return this.prisma.categoryDetail; }
  get pointHistory() { return this.prisma.pointHistory; }
  get mission() { return this.prisma.mission; }
  get missionSchedule() { return this.prisma.missionSchedule; }
  get missionAttempt() { return this.prisma.missionAttempt; }
  get missionCompletion() { return this.prisma.missionCompletion; }
  get quiz() { return this.prisma.quiz; }
  get quizAnswer() { return this.prisma.quizAnswer; }
  get apiKey() { return this.prisma.apiKey; }
  get content() { return this.prisma.content; }
  get contentFile() { return this.prisma.contentFile; }
  get contentView() { return this.prisma.contentView; }
  get lectureQuiz() { return this.prisma.lectureQuiz; }
  get lectureProduct() { return this.prisma.lectureProduct; }
  
  // 챌린지 도메인 테이블
  get challenge() { return this.prisma.challenge; }
  get challengeTicket() { return this.prisma.challengeTicket; }
  get userChallenge() { return this.prisma.userChallenge; }
  get challengeMission() { return this.prisma.challengeMission; }
  get challengeSurvey() { return this.prisma.challengeSurvey; }
  get challengeQuiz() { return this.prisma.challengeQuiz; }
  get challengeContent() { return this.prisma.challengeContent; }
  get recordItem() { return this.prisma.recordItem; }
  get userRecord() { return this.prisma.userRecord; }
  get dailyProgress() { return this.prisma.dailyProgress; }
  
  // 쇼핑몰 도메인 테이블
  get category() { return this.prisma.category; }
  get product() { return this.prisma.product; }
  get productImage() { return this.prisma.productImage; }
  get cart() { return this.prisma.cart; }
  get cartItem() { return this.prisma.cartItem; }
  get order() { return this.prisma.order; }
  get orderItem() { return this.prisma.orderItem; }
  get orderStateLog() { return this.prisma.orderStateLog; }
  get payment() { return this.prisma.payment; }
  get refund() { return this.prisma.refund; }
  get refundPolicy() { return this.prisma.refundPolicy; }
  get shipping() { return this.prisma.shipping; }
  get shippingTrack() { return this.prisma.shippingTrack; }
  get shippingPolicy() { return this.prisma.shippingPolicy; }
  get inventoryCache() { return this.prisma.inventoryCache; }
  get inventoryApiLog() { return this.prisma.inventoryApiLog; }
  get inventorySyncQueue() { return this.prisma.inventorySyncQueue; }
  get productReview() { return this.prisma.productReview; }
  get productQuestion() { return this.prisma.productQuestion; }
  get productFeedback() { return this.prisma.productFeedback; }
  get wishlist() { return this.prisma.wishlist; }
  get recentlyViewed() { return this.prisma.recentlyViewed; }
  get banner() { return this.prisma.banner; }
  
  // 온보딩 관련 테이블
  get aiPersona() { return this.prisma.aiPersona; }
  get userChallengeSurveyResult() { return this.prisma.userChallengeSurveyResult; }

  // 운동 관련 테이블
  get exerciseType() { return this.prisma.exerciseType; }

  // 커스텀 영양제 테이블
  get userCustomSupplement() { return this.prisma.userCustomSupplement; }

  // 밸런스게임 관련 테이블
  get balanceGame() { return this.prisma.balanceGame; }
  get balanceGameStep() { return this.prisma.balanceGameStep; }
  get badge() { return this.prisma.badge; }
  get userBadge() { return this.prisma.userBadge; }
  get userBalanceGameHistory() { return this.prisma.userBalanceGameHistory; }

  // 쿠폰 관련 테이블
  get coupon() { return this.prisma.coupon; }
  get userCoupon() { return this.prisma.userCoupon; }

  // 메서드 바인딩
  $transaction(arg: any) {
    return (this.prisma as any).$transaction(arg);
  }
  
  $queryRaw(query: TemplateStringsArray, ...values: any[]) {
    return (this.prisma as any).$queryRaw(query, ...values);
  }
  
  $executeRaw(query: TemplateStringsArray, ...values: any[]) {
    return (this.prisma as any).$executeRaw(query, ...values);
  }
  
  $connect() {
    return this.prisma.$connect();
  }
  
  $disconnect() {
    return this.prisma.$disconnect();
  }

  /**
   * 모듈 초기화 시 데이터베이스 연결
   * 애플리케이션 시작 시 자동으로 호출
   */
  async onModuleInit() {
    try {
      this.logger.log('데이터베이스 연결을 시작합니다...');
      await this.$connect();
      this.logger.log('데이터베이스 연결이 성공적으로 완료되었습니다.');
    } catch (error) {
      this.logger.error('데이터베이스 연결에 실패했습니다:', error);
      throw error;
    }
  }

  /**
   * 모듈 종료 시 데이터베이스 연결 해제
   * 애플리케이션 종료 시 자동으로 호출
   */
  async onModuleDestroy() {
    try {
      this.logger.log('데이터베이스 연결을 종료합니다...');
      await this.$disconnect();
      this.logger.log('데이터베이스 연결이 성공적으로 종료되었습니다.');
    } catch (error) {
      this.logger.error('데이터베이스 연결 종료 중 오류가 발생했습니다:', error);
      throw error;
    }
  }

  /**
   * 헬스체크를 위한 데이터베이스 연결 상태 확인
   * @returns Promise<boolean> 연결 상태 (true: 연결됨, false: 연결 안됨)
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.debug('데이터베이스 헬스체크 성공');
      return true;
    } catch (error) {
      this.logger.error('데이터베이스 헬스체크 실패:', error);
      return false;
    }
  }

  /**
   * Prisma Middleware로 시간대 자동 변환 설정
   * - 쓰기 작업: KST → UTC 변환
   * - 읽기 작업: UTC → KST 변환
   */
  private setupTimezoneMiddleware() {
    // Prisma Extension의 query 훅에서 자동 처리됨
  }
}