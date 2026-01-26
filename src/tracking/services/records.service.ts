import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Prisma } from '@prisma/client';
import { PointService } from '../../point/point.service';
import {
  getNowKST,
  parseKSTDateTime,
  extractKSTDate,
  getKoreanToday,
  calculateChallengeDay
} from '../../common/utils/kst-date.util';
import {
  CreateBeautyRecordDto,
  CreateDietRecordDto,
  CreateSupplementRecordDto,
  CreateFastingRecordDto,
  CreateSleepRecordDto,
  CreateActivityRecordDto,
} from '../dto/records/records.dto';
import { CategoryCode } from '@/common/enums/category-code.enum';
import { RecordType } from '@/common/enums/record-type.enum';
import { PointRelatedType, UserSubscriptionStatus } from '@/common/enums';
import { getPointDescription } from '../../common/utils/point-description.util';
import { SibApiService } from '../../sib/services/sib-api.service';

/**
 * 기록 서비스
 * 6가지 유형의 기록 생성 및 관리 (이너뷰티, 식단, 영양제, 공복, 수면, 활동)
 * 
 * 각 기록 완료시 포인트 100점 지급
 * 기존 포인트 지급 로직을 재사용하여 일관성 유지
 */
@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService,
    private readonly sibApiService: SibApiService,
  ) {}

  /**
   * 기록 목록 조회
   * @param userId 사용자 ID
   * @param filters 필터 옵션 (날짜, 기록 유형)
   * @param isNewcomer NEWCOMER 여부 (Guard에서 전달)
   */
  async getRecords(
    userId: number,
    filters: { date?: string; recordType?: string } = {},
    isNewcomer: boolean = false
  ) {
    try {
      const { date, recordType } = filters;

      // 기본값: 한국 시간 기준 오늘 날짜
      const targetDate = date || getKoreanToday();

      this.logger.log(`기록 목록 조회 - 사용자: ${userId}, 날짜: ${targetDate}, 타입: ${recordType || 'ALL'}, NEWCOMER: ${isNewcomer}`);

      // NEWCOMER는 예시 데이터 반환
      if (isNewcomer) {
        this.logger.log(`예시 데이터 생성 - 사용자: ${userId}`);
        return this.getSampleRecords(targetDate);
      }

      this.logger.log(`🔥 기록 서비스 변환 모드 활성화됨!`);

      const records = await this.prisma.userRecord.findMany({
        where: {
          userId,
          date: new Date(targetDate), // Date 객체로 변환
          ...(recordType && { recordType: recordType }),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      this.logger.log(`기록 변환 시작 - 총 ${records.length}개 기록`);

      // recordType별로 그룹화
      const groupedRecords = records.reduce((acc, record) => {
        if (!acc[record.recordType]) {
          acc[record.recordType] = [];
        }
        acc[record.recordType].push(record);
        return acc;
      }, {} as Record<string, any[]>);

      // 6개 recordType 전체 배열 (고정 순서: 뷰티, 식단, 영양제, 단식, 수면, 활동)
      const allRecordTypes = ['BEAUTY', 'DIET', 'SUPPLEMENT', 'FASTING', 'SLEEP', 'ACTIVITY'];

      const result = [];

      // 각 recordType을 순회하면서 데이터 생성
      for (const type of allRecordTypes) {
        const typeRecords = groupedRecords[type] || []; // 기록이 없으면 빈 배열

        if (typeRecords.length === 0) {
          // 기록이 없는 경우: null/빈값으로 채움
          result.push({
            id: null,
            recordType: type,
            date: null,
            metadata: {},
            currentCount: null,
            maxCount: null,
          });
        } else {
          // 기록이 있는 경우: 기존 로직대로 처리
          if (type === 'DIET' || type === 'ACTIVITY') {
            // DIET와 ACTIVITY는 모든 레코드를 종합해서 하나로 만듦
            const transformedMetadata = await this.transformRecordMetadata(type, typeRecords, userId, typeRecords[0].date);

            // 현재 기록 횟수 / 최대 기록 횟수 추가
            const recordLimit = await this.getRecordLimit(type, typeRecords);

            result.push({
              id: typeRecords[0].id, // 대표 ID
              recordType: type,
              date: typeRecords[0].date,
              metadata: transformedMetadata,
              currentCount: recordLimit.currentCount,
              maxCount: recordLimit.maxCount,
            });
          } else if (type === 'SUPPLEMENT') {
            // SUPPLEMENT는 모든 영양제 기록을 배열로 변환
            const supplementList = await this.transformSupplementRecords(
              userId,
              typeRecords,
            );

            const recordLimit = await this.getRecordLimit(type, typeRecords);

            result.push({
              id: typeRecords[0].id, // 대표 ID
              recordType: type,
              date: typeRecords[0].date,
              metadata: supplementList, // 배열 형태
              currentCount: recordLimit.currentCount,
              maxCount: recordLimit.maxCount,
            });
          } else {
            // 나머지는 개별 처리 (첫 번째 기록만 사용)
            const record = typeRecords[0];
            const transformedMetadata = await this.transformRecordMetadata(type, record.metadata, userId, record.date);

            // 현재 기록 횟수 / 최대 기록 횟수 추가
            const recordLimit = await this.getRecordLimit(type, typeRecords);

            result.push({
              id: record.id,
              recordType: type,
              date: record.date,
              metadata: transformedMetadata,
              currentCount: recordLimit.currentCount,
              maxCount: recordLimit.maxCount,
            });
          }
        }
      }

      return {
        success: true,
        data: result,
        isReal: true,
      };
    } catch (error) {
      this.logger.error(`기록 목록 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  /**
   * NEWCOMER용 예시 데이터 생성
   * @param targetDate 기준 날짜
   */
  private getSampleRecords(targetDate: string) {
    const sampleDate = new Date(targetDate);

    return {
      success: true,
      data: [
        {
          id: 9001,
          recordType: 'BEAUTY',
          date: sampleDate,
          metadata: {
            totalScore: 50,
            baseScore: 100,
          },
          currentCount: 1,
          maxCount: 1,
        },
        {
          id: 9002,
          recordType: 'DIET',
          date: sampleDate,
          metadata: {
            breakfastImg: 'https://example.com/sample/breakfast.jpg',
            lunchImg: 'https://example.com/sample/lunch.jpg',
            dinnerImg: 'https://example.com/sample/dinner.jpg',
            snackImg: null,
            allergyScore: 2,
            highFodmapCount: 1,
            processedCount: 3,
          },
          currentCount: 4,
          maxCount: 9,
        },
        {
          id: 9003,
          recordType: 'SUPPLEMENT',
          date: sampleDate,
          metadata: [
            {
              productId: 1,
              productName: '메타드림',
              intakeCount: 2,
              recommendedCount: 2,
            },
            {
              productId: 2,
              productName: '리셋데이',
              intakeCount: 1,
              recommendedCount: 1,
            },
            {
              productId: 3,
              productName: '오메가3',
              intakeCount: 0,
              recommendedCount: 1,
            },
          ],
          currentCount: 3,
          maxCount: 10,
        },
        {
          id: 9004,
          recordType: 'FASTING',
          date: sampleDate,
          metadata: {
            fastingTime: 960,
            targetTime: 960,
          },
          currentCount: 1,
          maxCount: 1,
        },
        {
          id: 9005,
          recordType: 'SLEEP',
          date: sampleDate,
          metadata: {
            sleepTime: 450,
            targetTime: 480,
          },
          currentCount: 1,
          maxCount: 1,
        },
        {
          id: 9006,
          recordType: 'ACTIVITY',
          date: sampleDate,
          metadata: {
            totalCalories: 350,
          },
          currentCount: 2,
          maxCount: 5,
        },
      ],
      isReal: false,
    };
  }

  /**
   * 뷰티 기록 저장
   * @param userId 사용자 ID
   * @param dto 뷰티 기록 데이터 (이너뷰티 4개 + 아우터뷰티 4개)
   */
  async createBeautyRecord(userId: number, dto: CreateBeautyRecordDto) {
    const targetDate = getKoreanToday();

    // 이너뷰티 점수 계산
    const innerBeautyScore = dto.innerBeauty.reduce((sum, item) => sum + item.score, 0);

    // 아우터뷰티 점수 계산
    const outerBeautyScore = dto.outerBeauty.reduce((sum, item) => sum + item.score, 0);

    return this.createRecord(userId, 'BEAUTY', {
      date: targetDate,
      metadata: {
        innerBeauty: dto.innerBeauty,
        outerBeauty: dto.outerBeauty,
        innerBeautyScore, // 이너뷰티 총점 (20~100점, 낮을수록 건강)
        outerBeautyScore, // 아우터뷰티 총점 (20~100점, 낮을수록 건강)
        totalScore: innerBeautyScore + outerBeautyScore, // 전체 총점 (40~200점, 낮을수록 건강)
      },
    });
  }

  /**
   * 식단 기록 저장 (새로운 구조)
   * @param userId 사용자 ID
   * @param dto 식단 기록 데이터 (단일 식품 등록)
   */
  async createDietRecord(userId: number, dto: CreateDietRecordDto) {
    const targetDate = getKoreanToday();

    // isFasting이 true인 경우 공복 식사로 기록
    if (dto.isFasting) {
      this.logger.log(`공복 식사 기록 생성 - 사용자: ${userId}, 식사: ${dto.diet}`);

      return this.createRecord(userId, 'DIET', {
        date: targetDate,
        metadata: {
          diet: dto.diet,           // 식사 종류 (BREAKFAST, LUNCH, etc.)
          isFasting: true,          // 공복 여부
          foodName: null,
          imageUrl: null,
          allergyFoods: [],
          highFodmapFoods: [],
          processedFoods: [],
          allergyScore: 0,
          highFodmapCount: 0,
          processedCount: 0,
        },
      });
    }

    // 일반 식단 기록 (isFasting이 false이거나 없는 경우)
    // 과민식품 개수 계산 (레벨과 무관하게 개수만)
    const allergyScore = dto.allergyFoods?.length || 0;

    // 고포드맵식품 개수
    const highFodmapCount = dto.highFodmapFoods?.length || 0;

    // 가공식품 개수
    const processedCount = dto.processedFoods?.length || 0;

    this.logger.log(`식단 기록 생성 - 사용자: ${userId}, 식품: ${dto.foodName}, 식사: ${dto.diet}`);

    return this.createRecord(userId, 'DIET', {
      date: targetDate,
      metadata: {
        diet: dto.diet,                    // 식사 종류 (BREAKFAST, LUNCH, etc.)
        isFasting: false,                  // 공복 아님
        foodName: dto.foodName,            // 식품명
        imageUrl: dto.imageUrl,            // 이미지 URL
        allergyFoods: dto.allergyFoods || [],    // 과민식품 배열 (name, level)
        highFodmapFoods: dto.highFodmapFoods || [], // 고포드맵식품 배열 (string[])
        processedFoods: dto.processedFoods || [],   // 가공식품 배열 (string[])
        // 통계용 계산된 값들
        allergyScore,      // 과민식품 점수 합계
        highFodmapCount,   // 고포드맵식품 개수
        processedCount,    // 가공식품 개수
      },
    });
  }

  /**
   * 영양제 섭취 기록 저장 (신규 - 루틴 기반)
   *
   * @deprecated 이 메서드는 더 이상 사용되지 않습니다. saveSupplementIntake()를 사용하세요.
   * @param userId 사용자 ID
   * @param dto 영양제 섭취 기록 데이터
   */
  async createSupplementRecord(userId: number, dto: CreateSupplementRecordDto) {
    this.logger.log(`영양제 기록 시작 - 사용자: ${userId}, 날짜: ${dto.date}, 상품: ${dto.productId}, 회차: ${dto.count}`);

    // 1. 루틴에 등록된 영양제인지 검증
    const routine = await this.prisma.userSupplementRoutine.findFirst({
      where: {
        userId,
        productId: dto.productId,
      },
    });

    if (!routine) {
      throw new ForbiddenException('루틴에 등록되지 않은 영양제는 기록할 수 없습니다.');
    }

    // 2. 영양제 상품 정보 조회
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, name: true },
    });

    if (!product) {
      throw new NotFoundException(`상품 ID ${dto.productId}를 찾을 수 없습니다.`);
    }

    // 3. 당일 SUPPLEMENT 기록 개수 확인 (최대 10회)
    const todaySupplementCount = await this.prisma.userRecord.count({
      where: {
        userId,
        recordType: 'SUPPLEMENT',
        date: new Date(dto.date),
      },
    });

    if (todaySupplementCount >= 10) {
      throw new BadRequestException('하루 최대 10회까지만 영양제를 기록할 수 있습니다.');
    }

    // 4. 사진 필수 여부 체크
    const hasTodayRecord = todaySupplementCount > 0;

    if (!hasTodayRecord && !dto.imageUrl) {
      throw new BadRequestException('당일 첫 영양제 기록 시 사진은 필수입니다.');
    }

    // 5. 기록 저장
    return this.createRecord(userId, 'SUPPLEMENT', {
      date: dto.date,
      metadata: {
        productId: product.id,
        productName: product.name,
        count: dto.count,
        imageUrl: dto.imageUrl || null,
      },
    });
  }

  /**
   * 영양제 목록 조회 (상품만)
   * @param userId 사용자 ID
   */
  async getSupplementList(userId: number) {
    this.logger.log(`영양제 목록 조회 - 사용자: ${userId}`);

    // 상품 테이블에서 영양제 카테고리 상품 조회
    const products = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        categoryCode: 'SUPPLEMENT', // 영양제 카테고리
      },
      select: {
        id: true,
        name: true,
        description: true,
        productFiles: {
          where: { imageType: 'MAIN' },
          include: { file: true },
          take: 1,
        },
        supplementNutrients: {
          select: {
            nutrientName: true,
          },
          orderBy: {
            nutrientName: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      success: true,
      data: {
        products: products.map(product => ({
          id: product.id,
          type: 'PRODUCT',
          name: product.name,
          description: product.description,
          imageUrl: product.productFiles[0]?.file?.filePath,
          nutrients: product.supplementNutrients.map(n => n.nutrientName),
        })),
      },
    };
  }

  /**
   * 간헐적 단식 기록 저장
   * @param userId 사용자 ID
   * @param dto 간헐적 단식 기록 데이터
   */
  async createFastingRecord(userId: number, dto: CreateFastingRecordDto) {
    const today = getKoreanToday();

    // ✅ KST DateTime 파싱 (프론트엔드에서 보내는 KST 문자열을 올바르게 파싱)
    const startDateTime = parseKSTDateTime(dto.startDateTime);
    const endDateTime = parseKSTDateTime(dto.endDateTime);

    // 유효성 검증
    this.validateFastingDateTime(startDateTime, endDateTime, today);

    // 단식 시간 계산 (소수점 첫째자리)
    const fastingHours = Math.round((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60) * 10) / 10;

    return this.createRecord(userId, 'FASTING', {
      date: today,
      metadata: {
        startDateTime: dto.startDateTime,
        endDateTime: dto.endDateTime,
        fastingHours,
      },
    });
  }

  /**
   * 단식 DateTime 유효성 검증
   */
  private validateFastingDateTime(startDateTime: Date, endDateTime: Date, today: string) {
    // ✅ KST 기준 날짜 추출 (이제 올바르게 동작)
    const startDateStr = extractKSTDate(startDateTime);
    const endDateStr = extractKSTDate(endDateTime);

    // 어제 날짜 계산
    const todayDate = new Date(today);
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    // startDateTime은 어제 또는 오늘만 가능
    if (startDateStr !== yesterdayStr && startDateStr !== today) {
      throw new BadRequestException('공복 시작 시간은 어제 또는 오늘만 가능합니다');
    }

    // endDateTime은 오늘만 가능
    if (endDateStr !== today) {
      throw new BadRequestException('공복 종료 시간은 오늘만 가능합니다');
    }

    // endDateTime >= startDateTime
    if (endDateTime <= startDateTime) {
      throw new BadRequestException('공복 종료 시간은 시작 시간보다 커야 합니다');
    }
  }


  /**
   * 수면 기록 저장
   * @param userId 사용자 ID
   * @param dto 수면 기록 데이터
   */
  async createSleepRecord(userId: number, dto: CreateSleepRecordDto) {
    const today = getKoreanToday();

    // ✅ KST DateTime 파싱 (프론트엔드에서 보내는 KST 문자열을 올바르게 파싱)
    const bedDateTime = parseKSTDateTime(dto.bedDateTime);
    const wakeDateTime = parseKSTDateTime(dto.wakeDateTime);

    // 유효성 검증
    this.validateSleepDateTime(bedDateTime, wakeDateTime, today);

    // 수면 시간 계산 (소수점 첫째자리)
    const sleepHours = Math.round((wakeDateTime.getTime() - bedDateTime.getTime()) / (1000 * 60 * 60) * 10) / 10;

    return this.createRecord(userId, 'SLEEP', {
      date: today,
      metadata: {
        bedDateTime: dto.bedDateTime,
        wakeDateTime: dto.wakeDateTime,
        sleepHours,
      },
    });
  }

  /**
   * 수면 DateTime 유효성 검증
   */
  private validateSleepDateTime(bedDateTime: Date, wakeDateTime: Date, today: string) {
    // ✅ KST 기준 날짜 추출 (이제 올바르게 동작)
    const bedDateStr = extractKSTDate(bedDateTime);
    const wakeDateStr = extractKSTDate(wakeDateTime);

    // 어제 날짜 계산
    const todayDate = new Date(today);
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    // bedDateTime은 어제 또는 오늘만 가능
    if (bedDateStr !== yesterdayStr && bedDateStr !== today) {
      throw new BadRequestException('잠든 시간은 어제 또는 오늘만 가능합니다');
    }

    // wakeDateTime은 오늘만 가능
    if (wakeDateStr !== today) {
      throw new BadRequestException('기상 시간은 오늘만 가능합니다');
    }

    // wakeDateTime >= bedDateTime
    if (wakeDateTime <= bedDateTime) {
      throw new BadRequestException('기상 시간은 잠든 시간보다 커야 합니다');
    }
  }

  /**
   * 활동 기록 저장 (새로운 구조)
   * @param userId 사용자 ID
   * @param dto 활동 기록 데이터 (activityType, activityTime, imageUrl)
   */
  async createActivityRecord(userId: number, dto: CreateActivityRecordDto) {
    // 서버 기준 오늘 날짜 사용 (클라이언트 날짜 무시)
    const targetDate = getKoreanToday();

    this.logger.log(`활동 기록 저장 시작 - 사용자: ${userId}, 날짜: ${targetDate}`);

    // exercise_types 테이블에서 운동 종목 검증
    const exerciseType = await this.prisma.exerciseType.findUnique({
      where: {
        code: dto.activityType.code,
        isActive: true,
      },
    });

    if (!exerciseType) {
      throw new NotFoundException(`존재하지 않는 운동 종목입니다: ${dto.activityType.code}`);
    }

    // activityTime을 분으로 변환 (HH:MM:SS -> 분)
    const timeToMinutes = (timeString: string): number => {
      const [hours, minutes, seconds] = timeString.split(':').map(Number);
      return hours * 60 + minutes + (seconds || 0) / 60;
    };

    const durationInMinutes = timeToMinutes(dto.activityTime);

    // missions 테이블에서 ACTIVITY의 daily_limit, daily_time_limit_minutes 조회
    const activityMission = await this.prisma.mission.findUnique({
      where: { recordType: 'ACTIVITY' },
      select: { dailyLimit: true, dailyTimeLimitMinutes: true },
    });
    const dailyLimit = activityMission?.dailyLimit || 5;
    const dailyTimeLimitMinutes = activityMission?.dailyTimeLimitMinutes || null;

    // 해당 날짜의 기존 활동 기록 조회
    const existingRecords = await this.prisma.userRecord.findMany({
      where: {
        userId,
        recordType: 'ACTIVITY',
        date: new Date(targetDate),
      },
    });

    // 1. 1일 최대 입력 횟수 체크 (missions 테이블 daily_limit 기준)
    if (existingRecords.length >= dailyLimit) {
      throw new BadRequestException(`하루 최대 ${dailyLimit}회까지만 활동을 기록할 수 있습니다.`);
    }

    // 2. 1일 최대 입력 시간 체크 (missions 테이블 daily_time_limit_minutes 기준)
    if (dailyTimeLimitMinutes) {
      const totalMinutes = existingRecords.reduce((sum, record) => {
        const metadata = record.metadata as any;
        return sum + (metadata.durationInMinutes || 0);
      }, 0);

      if (totalMinutes + durationInMinutes > dailyTimeLimitMinutes) {
        const remainingMinutes = dailyTimeLimitMinutes - totalMinutes;
        const remainingHours = Math.floor(remainingMinutes / 60);
        const remainingMins = remainingMinutes % 60;
        const limitHours = Math.floor(dailyTimeLimitMinutes / 60);
        throw new BadRequestException(
          `하루 최대 ${limitHours}시간까지만 활동을 기록할 수 있습니다. (남은 시간: ${remainingHours}시간 ${remainingMins}분)`
        );
      }
    }

    // 칼로리 계산 (DB의 calorie_rate는 10분당 소모 칼로리)
    const estimatedCalories = Math.round((exerciseType.calorieRate || 0) * (durationInMinutes / exerciseType.baseMinutes));

    this.logger.log(`칼로리 계산: ${exerciseType.name} ${dto.activityTime} = ${estimatedCalories}kcal`);

    return this.createRecord(userId, 'ACTIVITY', {
      date: targetDate,
      metadata: {
        activityType: {
          code: exerciseType.code,
          name: exerciseType.name,
          calorie_rate: exerciseType.calorieRate,
          base_minutes: exerciseType.baseMinutes,
        },
        activityTime: dto.activityTime,
        durationInMinutes,
        imageUrl: dto.imageUrl,
        estimatedCalories,
        // 통계 계산을 위한 추가 정보
        totalDuration: durationInMinutes, // 기존 통계 API 호환성
      },
    });
  }

  /**
   * 공통 기록 생성 로직
   * @param userId 사용자 ID
   * @param recordCode 기록 타입 코드
   * @param recordData 기록 데이터
   */
  private async createRecord(
    userId: number,
    recordCode: string,
    recordData: { date: string; metadata: any }
  ) {
    const { date, metadata } = recordData;

    try {
      this.logger.log(`${recordCode} 기록 저장 시작 - 사용자: ${userId}, 날짜: ${date}`);

      const result = await this.prisma.$transaction(async (tx) => {
        // 각 기록 타입별 구현으로 위임
        return await this.createRecordByType(tx, userId, recordCode, date, metadata);
      });

      return result;
    } catch (error) {
      this.logger.error(`${recordCode} 기록 저장 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 기록 타입별 구현 메서드 라우터
   */
  private async createRecordByType(
    tx: any,
    userId: number,
    recordCode: string,
    date: string,
    metadata: any
  ) {
    switch (recordCode) {
      case 'BEAUTY':
        return await this.createBeautyRecordImpl(tx, userId, date, metadata);
      case 'DIET':
        return await this.createDietRecordImpl(tx, userId, date, metadata);
      case 'SUPPLEMENT':
        return await this.createSupplementRecordImpl(tx, userId, date, metadata);
      case 'FASTING':
        return await this.createFastingRecordImpl(tx, userId, date, metadata);
      case 'SLEEP':
        return await this.createSleepRecordImpl(tx, userId, date, metadata);
      case 'ACTIVITY':
        return await this.createActivityRecordImpl(tx, userId, date, metadata);
      default:
        throw new Error(`지원하지 않는 기록 타입: ${recordCode}`);
    }
  }

  /**
   * 뷰티 기록 구현 (중복 불허, 1일 1회 포인트)
   * 포인트 지급 여부는 point_histories 테이블에서 확인 (동시 요청 중복 지급 방지)
   */
  private async createBeautyRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    // 중복 체크
    const existingRecord = await tx.userRecord.findFirst({
      where: { userId, recordType: 'BEAUTY', date: new Date(date) },
    });

    if (existingRecord) {
      throw new ConflictException(`오늘 이미 BEAUTY 기록을 완료했습니다`);
    }

    // 당일 뷰티 포인트 이미 받았는지 확인 (point_histories 테이블에서 직접 확인)
    const existingPointHistory = await tx.pointHistory.findFirst({
      where: {
        userId,
        recordType: RecordType.BEAUTY,
        createdAt: {
          gte: new Date(`${date} 00:00:00`),
          lte: new Date(`${date} 23:59:59.999`),
        },
      },
    });

    // 포인트 지급 여부 (당일 point_histories에 BEAUTY 기록이 없으면 지급)
    const pointsToAward = existingPointHistory ? 0 : 100;

    return await this.createRecordBase(tx, userId, 'BEAUTY', date, metadata, pointsToAward);
  }

  /**
   * 식단 기록 구현
   * 아침/점심/저녁: 각각 1일 1회만 허용, 각각 첫 기록 시 100점 (최대 300점)
   * 간식: 1일 3회까지 허용, 포인트 없음
   * 야식: 1일 3회까지 허용, 포인트 없음
   * 포인트 지급 여부는 point_histories 테이블에서 확인 (동시 요청 중복 지급 방지)
   */
  private async createDietRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    const dietType = metadata.diet;

    // 오늘 날짜의 모든 식단 기록 조회
    const todayRecords = await tx.userRecord.findMany({
      where: {
        userId,
        recordType: 'DIET',
        date: new Date(date)
      }
    });

    // 같은 diet 타입 개수 확인
    const sameDietTypeCount = todayRecords.filter((r: any) => r.metadata?.diet === dietType).length;

    // 아침/점심/저녁: 1번만 허용
    if (dietType === 'BREAKFAST' || dietType === 'LUNCH' || dietType === 'DINNER') {
      if (sameDietTypeCount >= 1) {
        throw new ConflictException(`오늘 이미 ${dietType} 기록을 완료했습니다`);
      }

      // 당일 DIET 포인트 지급 횟수 확인 (point_histories에서 확인, 최대 3회 = 300포인트)
      const dietPointCount = await tx.pointHistory.count({
        where: {
          userId,
          recordType: RecordType.DIET,
          createdAt: {
            gte: new Date(`${date} 00:00:00`),
            lte: new Date(`${date} 23:59:59.999`),
          },
        },
      });

      // 포인트 지급 여부 (당일 DIET 포인트가 3회 미만이면 지급)
      const pointsToAward = dietPointCount < 3 ? 100 : 0;

      return await this.createRecordBase(tx, userId, 'DIET', date, metadata, pointsToAward);
    }

    // 간식/야식: 3번까지 허용
    if (dietType === 'SNACK' || dietType === 'MIDNIGHT_SNACK') {
      if (sameDietTypeCount >= 3) {
        throw new ConflictException(`오늘 ${dietType} 기록은 최대 3회까지만 가능합니다`);
      }
      // 포인트 없음
      return await this.createRecordBase(tx, userId, 'DIET', date, metadata, 0);
    }

    // 그 외 타입은 일단 허용 (포인트 없음)
    return await this.createRecordBase(tx, userId, 'DIET', date, metadata, 0);
  }

  /**
   * 영양제 기록 구현 (중복 허용, 1일 1회 포인트)
   */
  private async createSupplementRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    // 오늘 첫 번째 영양제 기록인지 확인 (포인트 지급 여부 결정)
    const existingRecord = await tx.userRecord.findFirst({
      where: { userId, recordCode: 'SUPPLEMENT', date },
    });

    // 첫 번째 기록이면 100포인트, 아니면 0포인트
    const pointsToAward = existingRecord ? 0 : 100;

    return await this.createRecordBase(tx, userId, 'SUPPLEMENT', date, metadata, pointsToAward);
  }

  /**
   * 간헐적단식 기록 구현 (중복 불허, 1일 1회 포인트)
   * 포인트 지급 여부는 point_histories 테이블에서 확인 (동시 요청 중복 지급 방지)
   */
  private async createFastingRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    // 중복 체크
    const existingRecord = await tx.userRecord.findFirst({
      where: { userId, recordType: 'FASTING', date: new Date(date) },
    });

    if (existingRecord) {
      throw new ConflictException(`오늘 이미 FASTING 기록을 완료했습니다`);
    }

    // 당일 단식 포인트 이미 받았는지 확인 (point_histories 테이블에서 직접 확인)
    const existingPointHistory = await tx.pointHistory.findFirst({
      where: {
        userId,
        recordType: RecordType.FASTING,
        createdAt: {
          gte: new Date(`${date} 00:00:00`),
          lte: new Date(`${date} 23:59:59.999`),
        },
      },
    });

    // 포인트 지급 여부 (당일 point_histories에 FASTING 기록이 없으면 지급)
    const pointsToAward = existingPointHistory ? 0 : 100;

    return await this.createRecordBase(tx, userId, 'FASTING', date, metadata, pointsToAward);
  }

  /**
   * 수면 기록 구현 (중복 불허, 1일 1회 포인트)
   * 포인트 지급 여부는 point_histories 테이블에서 확인 (동시 요청 중복 지급 방지)
   */
  private async createSleepRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    // 중복 체크
    const existingRecord = await tx.userRecord.findFirst({
      where: { userId, recordType: 'SLEEP', date: new Date(date) },
    });

    if (existingRecord) {
      throw new ConflictException(`오늘 이미 SLEEP 기록을 완료했습니다`);
    }

    // 당일 수면 포인트 이미 받았는지 확인 (point_histories 테이블에서 직접 확인)
    const existingPointHistory = await tx.pointHistory.findFirst({
      where: {
        userId,
        recordType: RecordType.SLEEP,
        createdAt: {
          gte: new Date(`${date} 00:00:00`),
          lte: new Date(`${date} 23:59:59.999`),
        },
      },
    });

    // 포인트 지급 여부 (당일 point_histories에 SLEEP 기록이 없으면 지급)
    const pointsToAward = existingPointHistory ? 0 : 100;

    return await this.createRecordBase(tx, userId, 'SLEEP', date, metadata, pointsToAward);
  }

  /**
   * 활동 기록 구현 (중복 허용, 1일 1회 포인트)
   * 포인트 지급 여부는 point_histories 테이블에서 확인 (동시 요청 중복 지급 방지)
   */
  private async createActivityRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    // 당일 활동 포인트 이미 받았는지 확인 (point_histories 테이블에서 직접 확인)
    // DB의 created_at은 KST 기준으로 저장됨
    const existingPointHistory = await tx.pointHistory.findFirst({
      where: {
        userId,
        recordType: RecordType.ACTIVITY,
        createdAt: {
          gte: new Date(`${date} 00:00:00`),
          lte: new Date(`${date} 23:59:59.999`),
        },
      },
    });

    // 포인트 지급 여부 (당일 point_histories에 ACTIVITY 기록이 없으면 첫 번째)
    const pointsToAward = existingPointHistory ? 0 : 100;

    this.logger.log(`활동 기록 저장 - 사용자: ${userId}, 날짜: ${date}, 운동: ${metadata.activityType?.name}, 포인트: ${pointsToAward}점`);

    return await this.createRecordBase(tx, userId, 'ACTIVITY', date, metadata, pointsToAward);
  }

  /**
   * 기록 저장 및 포인트 지급 공통 로직
   */
  private async createRecordBase(
    tx: any,
    userId: number,
    recordCode: string,
    date: string,
    metadata: any,
    pointsToAward: number
  ) {
    // 활성 챌린지 확인
    const activeChallenge = await tx.userChallenge.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    // 챌린지 일차 계산
    const currentDay = activeChallenge ? calculateChallengeDay(activeChallenge.activatedAt) : null;

    // 해당 recordType에 맞는 challengeMission 조회 (놓친 미션 로직에서 완료 여부 판단용)
    let challengeMissionId: number | null = null;
    let missionId: number | null = null;
    let missionName: string | null = null;

    // 미션 설정 및 pointsConfig 조회
    let mission: any = null;
    if (activeChallenge && currentDay) {
      // missions 테이블에서 recordType으로 미션 조회
      mission = await tx.mission.findFirst({
        where: {
          recordType: recordCode,
          isActive: true,
        },
      });

      if (mission) {
        missionId = mission.id;
        missionName = mission.name;

        // challenge_missions 테이블에서 해당 일차의 미션 조회
        const challengeMission = await tx.challengeMission.findFirst({
          where: {
            productId: activeChallenge.productId,
            missionId: mission.id,
            day: currentDay,
            isActive: true,
          },
        });

        if (challengeMission) {
          challengeMissionId = challengeMission.id;
        }
      }
    }

    // pointsConfig 기반 포인트 지급 가능 여부 체크
    let actualPointsToAward = pointsToAward;
    if (pointsToAward > 0 && mission?.pointsConfig) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });

      if (user) {
        const pointsConfig = mission.pointsConfig as {
          afterChallengeDays?: number;
          subscriberUnlimited?: boolean;
        };

        // 구독자인 경우
        if (user.status === UserSubscriptionStatus.SUBSCRIBER) {
          if (!pointsConfig.subscriberUnlimited) {
            this.logger.log(`포인트 지급 제한 - 사용자: ${userId}, 구독자 무제한 설정 없음`);
            actualPointsToAward = 0;
          }
          // subscriberUnlimited === true 이면 그대로 지급
        }
        // 챌린지 진행 중인 경우 (CHALLENGER) - 기본적으로 포인트 지급
        else if (user.status === UserSubscriptionStatus.CHALLENGER) {
          // 챌린지 진행 중에는 기본적으로 포인트 지급 (별도 제한 없음)
        }
        // NEWCOMER인 경우 (챌린지 종료 후) - 기록형 미션은 포인트 지급 안함
        else if (user.status === UserSubscriptionStatus.NEWCOMER) {
          // 기록형 미션에서 NEWCOMER는 포인트 지급 안함 (afterChallengeDays 설정과 무관)
          this.logger.log(`포인트 지급 제한 - 사용자: ${userId}, NEWCOMER 상태 (기록형 미션)`);
          actualPointsToAward = 0;
        }
      }
    }

    // 기록 저장 (pointsEarned, isCompleted, day, challengeMissionId를 metadata에 포함)
    const metadataWithPoints = {
      ...metadata,
      pointsEarned: actualPointsToAward,
      isCompleted: true,
      day: currentDay,
      challengeMissionId,
      missionId,
      missionName,
    };

    const userRecord = await tx.userRecord.create({
      data: {
        userId,
        userChallengeId: activeChallenge?.id || null,
        recordType: recordCode,
        date: new Date(date),
        metadata: metadataWithPoints,
        createdAt: getNowKST(),
      },
    });

    // 포인트 지급 (조건부)
    if (actualPointsToAward > 0) {
      await this.pointService.awardPointsInTransaction(
        tx,
        userId,
        actualPointsToAward,
        getPointDescription(PointRelatedType.RECORD_COMPLETION, recordCode),
        PointRelatedType.RECORD_COMPLETION,
        userRecord.id,
        recordCode,
      );
    }

    this.logger.log(`${recordCode} 기록 저장 완료 - 사용자: ${userId}, 포인트: ${actualPointsToAward}점 지급`);

    return {
      id: userRecord.id,
      recordType: recordCode,
      date,
      pointsEarned: actualPointsToAward,
      metadata,
    };
  }

  /**
   * 운동 종목 목록 조회
   */
  async getExerciseTypes() {
    try {
      this.logger.log('운동 종목 목록 조회');

      // 데이터베이스에서 활성화된 운동 종목 조회
      const exerciseTypes = await this.prisma.exerciseType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });

      // 운동 종목 배열로 반환 (카테고리 그룹핑 제거)
      const result = exerciseTypes.map(exercise => ({
        code: exercise.code,
        name: exercise.name,
        calorieRate: exercise.calorieRate,
        baseMinutes: exercise.baseMinutes,
      }));

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('운동 종목 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 기록 타입별 현재 기록 횟수 / 최대 기록 횟수 반환
   * @param recordType 기록 타입
   * @param records 해당 날짜의 해당 타입 기록 배열
   *
   * currentCount/maxCount 의미:
   * - SUPPLEMENT: 실제 섭취 체크 횟수 (morning/afternoon/evening 중 true 개수 합계) / 10
   *   → 영양제는 종류별로 1개 레코드가 미리 생성되므로 records.length가 아닌 실제 체크 횟수로 계산
   * - 기타 타입: 당일 기록 횟수 / dailyLimit
   */
  private async getRecordLimit(recordType: string, records: any[]): Promise<{ currentCount: number; maxCount: number }> {
    // missions 테이블에서 dailyLimit 조회
    const mission = await this.prisma.mission.findUnique({
      where: { recordType },
      select: { dailyLimit: true },
    });

    const maxCount = mission?.dailyLimit ?? -1;

    // SUPPLEMENT: 실제 섭취 체크 횟수로 계산 (morning/afternoon/evening 중 true인 개수 합계)
    if (recordType === 'SUPPLEMENT') {
      const intakeCount = records.reduce((total, record) => {
        const metadata = record.metadata as any;
        const checkCount = [
          metadata?.morning,
          metadata?.afternoon,
          metadata?.evening,
        ].filter(Boolean).length;
        return total + checkCount;
      }, 0);
      return { currentCount: intakeCount, maxCount };
    }

    return { currentCount: records.length, maxCount };
  }

  /**
   * 기록 메타데이터를 형님이 원하는 형태로 변환
   * @param recordType 기록 타입
   * @param metadata 원본 메타데이터 (DIET의 경우 레코드 배열)
   * @param userId 사용자 ID
   * @param date 기록 날짜
   */
  private async transformRecordMetadata(recordType: string, metadata: any, userId: number, date: any) {
    switch (recordType) {
      case 'BEAUTY':
        return this.transformBeautyMetadata(metadata, userId, date);
      case 'DIET':
        // DIET는 레코드 배열이 들어옴
        return this.transformDietMetadata(metadata);
      // case 'SUPPLEMENT':
      //   return this.transformSupplementMetadata(metadata);
      case 'FASTING':
        return this.transformFastingMetadata(metadata);
      case 'SLEEP':
        return this.transformSleepMetadata(metadata);
      case 'ACTIVITY':
        return this.transformActivityMetadata(metadata);
      default:
        return metadata;
    }
  }

  /**
   * 이너뷰티 메타데이터 변환
   * 정책: (이너뷰티점수 + 아우터뷰티점수) / 2, 정수로 반올림
   */
  private async transformBeautyMetadata(metadata: any, userId: number, date: string) {
    const innerScore = metadata.innerBeautyScore || 0;
    const outerScore = metadata.outerBeautyScore || 0;
    const averageScore = Math.round((innerScore + outerScore) / 2); // 정수로 반올림

    return {
      totalScore: averageScore,
      baseScore: 100,
    };
  }

  /**
   * 식단 메타데이터 변환
   * 정책: 아침/점심/저녁/간식 이미지 + 과민식품/고포드맵/가공식품 카운트 종합
   * @param dataOrRecords 레코드 배열 또는 단일 메타데이터 (배열이면 종합, 아니면 단일)
   */
  private transformDietMetadata(dataOrRecords: any) {
    // 배열이 아니면 배열로 감싸기
    const records = Array.isArray(dataOrRecords) ? dataOrRecords : [{ metadata: dataOrRecords }];

    const result: any = {
      breakfastImg: null,
      lunchImg: null,
      dinnerImg: null,
      snackImg: null,
      allergyScore: 0,
      highFodmapCount: 0,
      processedCount: 0,
    };

    // 각 레코드를 순회하면서 데이터 수집
    records.forEach((record) => {
      const metadata = record.metadata;

      // 식사 타입별 이미지 URL 매핑
      const dietType = metadata.diet;
      if (dietType === 'BREAKFAST' && metadata.imageUrl) {
        result.breakfastImg = metadata.imageUrl;
      } else if (dietType === 'LUNCH' && metadata.imageUrl) {
        result.lunchImg = metadata.imageUrl;
      } else if (dietType === 'DINNER' && metadata.imageUrl) {
        result.dinnerImg = metadata.imageUrl;
      } else if (dietType === 'SNACK' && metadata.imageUrl) {
        result.snackImg = metadata.imageUrl;
      }

      // 카운트 누적
      result.allergyScore += metadata.allergyScore || 0;
      result.highFodmapCount += metadata.highFodmapCount || 0;
      result.processedCount += metadata.processedCount || 0;
    });

    return result;
  }

  /**
   * 영양제 메타데이터 변환
   * TODO: 영양제 기획 확정 후 재개 (몇일 내 예정)
   */
  // private transformSupplementMetadata(metadata: any) {
  //   const complianceRate = metadata.totalCount > 0
  //     ? Math.round((metadata.takenCount / metadata.totalCount) * 100)
  //     : 0;

  //   return {
  //     takenCount: metadata.takenCount,
  //     targetCount: metadata.totalCount,
  //     complianceRate: complianceRate,
  //   };
  // }

  /**
   * 간헐적 단식 메타데이터 변환
   * 정책: 시간 단위를 분 단위로 변환
   */
  private transformFastingMetadata(metadata: any) {
    const fastingHours = metadata.fastingHours || 0;
    const fastingTime = Math.round(fastingHours * 60); // 분 단위로 변환

    return {
      fastingTime: fastingTime,
      targetTime: 16 * 60, // 16시간 = 960분
    };
  }

  /**
   * 수면 메타데이터 변환
   * 정책: 시간 단위를 분 단위로 변환
   */
  private transformSleepMetadata(metadata: any) {
    const sleepHours = metadata.sleepHours || 0;
    const sleepTime = Math.round(sleepHours * 60); // 분 단위로 변환

    return {
      sleepTime: sleepTime,
      targetTime: 8 * 60, // 8시간 = 480분
    };
  }

  /**
   * 활동 메타데이터 변환
   * 정책: 해당 날짜의 모든 활동 칼로리를 합산
   * @param dataOrRecords 레코드 배열 또는 단일 메타데이터 (배열이면 종합, 아니면 단일)
   */
  private transformActivityMetadata(dataOrRecords: any) {
    // 배열이 아니면 배열로 감싸기
    const records = Array.isArray(dataOrRecords) ? dataOrRecords : [{ metadata: dataOrRecords }];

    // 모든 활동의 칼로리 합산
    const totalCalories = records.reduce((sum, record) => {
      const metadata = record.metadata;
      return sum + (metadata.estimatedCalories || 0);
    }, 0);

    return {
      totalCalories,
    };
  }

  /**
   * 이전 날짜 계산 헬퍼 함수
   */
  private getPreviousDate(dateString: string): string {
    const date = new Date(dateString);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }

  /**
   * 뷰티 설문지 조회
   * @description 뷰티 기록 작성에 필요한 설문지 질문 목록 조회 (이너뷰티 4개 + 아우터뷰티 4개)
   * DAILY 옵션(5/10/15/20/25 점수 체계)도 함께 반환
   */
  async getBeautyQuestions() {
    try {
      this.logger.log('뷰티 설문지 조회');

      // DB에서 활성화된 설문지 조회
      const questions = await this.prisma.beautyQuestion.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          type: true,
          category: true,
          question: true,
          sortOrder: true,
        },
      });

      // DAILY 옵션 정의 (5점 척도, 점수: 5/10/15/20/25)
      const dailyOptions = [
        { id: 1, text: '매우 그렇지 않다', score: 5 },
        { id: 2, text: '그렇지 않다', score: 10 },
        { id: 3, text: '보통이다', score: 15 },
        { id: 4, text: '그렇다', score: 20 },
        { id: 5, text: '매우 그렇다', score: 25 },
      ];

      // 이너뷰티와 아우터뷰티로 분류 (옵션 포함)
      const innerBeauty = questions
        .filter(q => q.type === 'INNER')
        .map(q => ({
          id: q.id,
          category: q.category,
          question: q.question,
          options: dailyOptions,
        }));

      const outerBeauty = questions
        .filter(q => q.type === 'OUTER')
        .map(q => ({
          id: q.id,
          category: q.category,
          question: q.question,
          options: dailyOptions,
        }));

      return {
        success: true,
        message: '뷰티 설문지 조회 성공',
        data: {
          innerBeauty,
          outerBeauty,
        },
      };
    } catch (error) {
      this.logger.error('뷰티 설문지 조회 실패', error);
      throw error;
    }
  }

  /**
   * 식단 초기 데이터 조회
   * @description 사용자의 지연성알러지 검사 결과를 바탕으로 알러지 식품, 고포드맵 식품, 가공식품 목록을 조회
   * @param userId 사용자 ID
   */
  async getDietInitData(userId: number) {
    try {
      this.logger.log(`식단 초기 데이터 조회 - 사용자: ${userId}`);

      // 사용자 정보 조회 (휴대폰번호)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { mobile: true },
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // 고포드맵 식품 조회
      const highFodmapFoods = await this.prisma.foodCategory.findMany({
        where: {
          category: 'HIGH_FODMAP',
          isActive: true,
        },
        orderBy: { displayOrder: 'asc' },
        select: { name: true },
      });

      // 가공식품 조회
      const processedFoods = await this.prisma.foodCategory.findMany({
        where: {
          category: 'PROCESSED',
          isActive: true,
        },
        orderBy: { displayOrder: 'asc' },
        select: { name: true },
      });

      // 알러지 식품 조회 (지연성 알러지 검사 결과)
      const allergyFoods = await this.getAllergyFoods(user.mobile, userId);

      return {
        success: true,
        message: '요청이 성공적으로 처리되었습니다.',
        data: {
          allergyFoods,
          highFodmapFoods: highFodmapFoods.map(f => f.name),
          processedFoods: processedFoods.map(f => f.name),
        },
        timestamp: getNowKST().toISOString(),
      };
    } catch (error) {
      this.logger.error(`식단 초기 데이터 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 지연성 알러지 검사 결과 조회
   * @param mobile 휴대폰번호 (자동 복호화됨)
   * @param userId 사용자 ID (DB 캐시 저장용)
   */
  private async getAllergyFoods(mobile: string, userId: number): Promise<Array<{ name: string; level: number }>> {
    try {
      const result = await this.sibApiService.getAllergyFoodsByMobile(mobile, userId);

      if (!result) {
        throw new ForbiddenException('접근 권한이 없습니다.');
      }

      return result.foods;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('지연성 알러지 검사 결과 조회 실패', error);
      throw error;
    }
  }

  /**
   * 내 영양제 루틴 조회
   * @description user_supplement_routine 테이블과 products 테이블을 조인하여
   *              사용자의 영양제 루틴 목록을 조회
   * @param userId 사용자 ID
   * @returns 영양제 루틴 목록
   */
  async getSupplementRoutine(userId: number) {
    try {
      this.logger.log(`영양제 루틴 조회 시작: userId=${userId}`);

      // KST 기준 당일 날짜
      const today = getKoreanToday();
      const dateObj = new Date(today);

      // user_supplement_routine과 products를 조인하여 조회 (영양제 카테고리만)
      const routines = await this.prisma.userSupplementRoutine.findMany({
        where: {
          userId,
          isActive: true,
          product: {
            categoryCode: CategoryCode.SUPPLEMENT,
          },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              productInfo: true,
              productFiles: {
                where: {
                  imageType: 'MAIN',
                },
                include: {
                  file: true,
                },
                orderBy: { sortOrder: 'asc' },
                take: 1,
              },
            },
          },
        },
        orderBy: {
          displayOrder: 'asc',
        },
      });

      this.logger.log(`영양제 루틴 조회 완료: ${routines.length}개`);

      // 당일 user_records에서 각 영양제의 섭취 기록 조회
      const records = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'SUPPLEMENT',
          date: dateObj,
        },
      });

      // productId별 섭취 기록 매핑
      const recordMap = new Map();
      records.forEach(record => {
        const metadata = record.metadata as any;
        if (metadata?.productId) {
          recordMap.set(metadata.productId, {
            morning: metadata.morning || false,
            afternoon: metadata.afternoon || false,
            evening: metadata.evening || false,
          });
        }
      });

      // 응답 데이터 변환
      const result = routines.map(routine => {
        const intakeRecord = recordMap.get(routine.productId) || {
          morning: false,
          afternoon: false,
          evening: false,
        };

        return {
          routineId: routine.id,
          productId: routine.productId,
          productName: routine.product.name,
          productImage: routine.product.productFiles[0]?.file.filePath || null,
          dosage: routine.product.productInfo
            ? {
                frequency: routine.product.productInfo['frequency_per_day'] || 0,
                quantity: routine.product.productInfo['quantity_per_dose'] || 0,
                unit: routine.product.productInfo['unit'] || '정',
              }
            : {
                frequency: 0,
                quantity: 0,
                unit: '정',
              },
          isDefault: routine.isDefault,
          displayOrder: routine.displayOrder,
          morning: intakeRecord.morning,
          afternoon: intakeRecord.afternoon,
          evening: intakeRecord.evening,
        };
      });

      return result;
    } catch (error) {
      this.logger.error('영양제 루틴 조회 실패', error);
      throw error;
    }
  }

  /**
   * 영양제 섭취 기록 저장
   * @description 여러 영양제의 아침/점심/저녁 섭취 여부를 한 번에 저장
   * @param userId 사용자 ID
   * @param saveSupplementIntakeDto 영양제 섭취 데이터
   * @returns 저장 결과
   */
  async saveSupplementIntake(userId: number, saveSupplementIntakeDto: any) {
    try {
      const { imageUrl, data } = saveSupplementIntakeDto;

      // KST 기준 당일 날짜 가져오기
      const today = getKoreanToday();
      const dateObj = new Date(today);

      this.logger.log(`영양제 섭취 기록 저장 시작: userId=${userId}, date=${today}`);

      // 1. 당일 영양제 기록 중 imageUrl이 있는지 조회 (사진 필수 검증용) - 트랜잭션 밖에서 검증
      const existingRecordWithImage = await this.prisma.userRecord.findFirst({
        where: {
          userId,
          recordType: 'SUPPLEMENT',
          date: dateObj,
          metadata: {
            path: ['imageUrl'],
            not: Prisma.AnyNull,
          },
        },
      });

      this.logger.log(
        `당일 사진 기록 조회 결과: ${existingRecordWithImage ? '있음' : '없음'}`,
      );

      // 2. imageUrl 없고, 기존 기록에도 사진이 없으면 400 오류
      if (!imageUrl && !existingRecordWithImage) {
        throw new BadRequestException(
          `${today}일 영양제 사진이 없습니다. 최초 기록 시 사진을 업로드해주세요.`,
        );
      }

      // 3. 트랜잭션 안에서 포인트 조회 및 지급 처리 (동시 요청 중복 지급 방지)
      const result = await this.prisma.$transaction(async (tx) => {
        // 당일 영양제 포인트 이미 받았는지 확인 (point_histories 테이블에서 직접 확인)
        // DB의 created_at은 KST 기준으로 저장됨
        const existingPointHistory = await tx.pointHistory.findFirst({
          where: {
            userId,
            recordType: RecordType.SUPPLEMENT,
            createdAt: {
              gte: new Date(`${today} 00:00:00`),
              lte: new Date(`${today} 23:59:59.999`),
            },
          },
        });

        // 포인트 지급 여부 (당일 point_histories에 SUPPLEMENT 기록이 없으면 첫 번째)
        const isFirstRecordOfDay = !existingPointHistory;

        this.logger.log(
          `당일 포인트 지급 여부: ${isFirstRecordOfDay ? '지급 예정' : '이미 지급됨'} (point_histories 확인, today=${today})`,
        );

        // 활성 챌린지 조회 (userChallengeId 업데이트용)
        const activeChallenge = await tx.userChallenge.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
          },
        });

        // RequestBody의 배열만큼 루프 돌면서 각 레코드 업데이트
        let firstRecordId: number | undefined;

        for (let index = 0; index < data.length; index++) {
          const item = data[index];
          const { productId, morning, afternoon, evening } = item;

          // 해당 productId의 기록 조회
          const record = await tx.userRecord.findFirst({
            where: {
              userId,
              recordType: 'SUPPLEMENT',
              date: dateObj,
              metadata: {
                path: ['productId'],
                equals: productId,
              },
            },
          });

          if (!record) {
            this.logger.warn(
              `영양제 기록을 찾을 수 없습니다: userId=${userId}, date=${today}, productId=${productId}`,
            );
            continue;
          }

          // metadata 업데이트 (기존 metadata 유지하면서 업데이트)
          const existingMetadata = (record.metadata as any) || {};
          const updatedMetadata: any = {
            ...existingMetadata, // 기존 metadata 유지 (imageUrl 등)
            productId,
            morning,
            afternoon,
            evening,
            isCompleted: true, // 기록 완료 표식 (홈 미션목록 완료 판단용)
          };

          // 새 imageUrl이 있으면 덮어쓰기 (없으면 기존 imageUrl 유지)
          if (imageUrl) {
            updatedMetadata.imageUrl = imageUrl;
          }

          // 당일 최초 기록이고 첫 번째 아이템인 경우 pointsEarned 추가 및 relatedId 저장
          if (isFirstRecordOfDay && index === 0) {
            updatedMetadata.pointsEarned = 100;
            firstRecordId = record.id;
          }

          // 레코드 업데이트 (userChallengeId도 함께 업데이트)
          await tx.userRecord.update({
            where: { id: record.id },
            data: {
              metadata: updatedMetadata,
              userChallengeId: activeChallenge?.id || null,
              updatedAt: getNowKST(),
            },
          });
        }

        // 당일 최초 기록이면 포인트 100점 지급 (트랜잭션 안에서 처리)
        if (isFirstRecordOfDay) {
          await this.pointService.awardPointsInTransaction(
            tx,
            userId,
            100,
            getPointDescription(PointRelatedType.RECORD_COMPLETION, RecordType.SUPPLEMENT),
            PointRelatedType.RECORD_COMPLETION,
            firstRecordId,
            RecordType.SUPPLEMENT,
          );

          this.logger.log(`포인트 100점 지급 완료: userId=${userId}`);
        }

        return { isFirstRecordOfDay };
      });

      this.logger.log(`영양제 섭취 기록 저장 완료: ${data.length}개 업데이트`);

      return {
        message: '영양제 섭취 기록이 저장되었습니다.',
        pointsEarned: result.isFirstRecordOfDay ? 100 : 0,
      };
    } catch (error) {
      this.logger.error('영양제 섭취 기록 저장 실패', error);
      throw error;
    }
  }

  /**
   * 영양제 기록 변환 (배열 형태)
   * - user_records의 영양제 기록을 productId별로 그룹화
   * - 각 영양제의 product 정보 조회 (이름, frequency_per_day)
   * - 섭취량 = morning + afternoon + evening 중 true 개수 (최대값은 frequency_per_day)
   * - user_supplement_routine의 display_order 순서로 정렬
   * - [{ productId, productName, intakeCount, recommendedCount }] 형태로 반환
   */
  private async transformSupplementRecords(
    userId: number,
    typeRecords: any[],
  ) {
    try {
      // productId 추출
      const productIds = typeRecords
        .map((record) => {
          const metadata = record.metadata as any;
          return metadata?.productId;
        })
        .filter((id) => id !== undefined);

      if (productIds.length === 0) {
        return [];
      }

      // user_supplement_routine에서 display_order 조회
      const routineList = await this.prisma.userSupplementRoutine.findMany({
        where: {
          userId,
          isActive: true,
          productId: { in: productIds },
        },
        select: {
          productId: true,
          displayOrder: true,
        },
      });

      // productId별 displayOrder 매핑
      const displayOrderMap = new Map<number, number>(
        routineList.map((r) => [r.productId, r.displayOrder]),
      );

      // products 테이블에서 상품명 + product_info 조회 (영양제 카테고리만)
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
          categoryCode: 'SUPPLEMENT',
        },
        select: {
          id: true,
          name: true,
          productInfo: true,
        },
      });

      // productId별 정보 매핑
      const productInfoMap = new Map<
        number,
        { name: string; frequencyPerDay: number }
      >(
        products.map((p) => [
          p.id,
          {
            name: p.name,
            frequencyPerDay: p.productInfo
              ? (p.productInfo as any)['frequency_per_day'] || 1
              : 1,
          },
        ]),
      );

      // 영양제 카테고리인 productId만 필터링
      const supplementProductIds = new Set(products.map((p) => p.id));

      // 영양제 배열 생성 (영양제 카테고리만)
      const supplementList = typeRecords
        .filter((record) => {
          const metadata = record.metadata as any;
          return supplementProductIds.has(metadata.productId);
        })
        .map((record) => {
          const metadata = record.metadata as any;
          const productInfo = productInfoMap.get(metadata.productId)!;
          const displayOrder = displayOrderMap.get(metadata.productId) || 9999;

          // 섭취 횟수 계산 (morning, afternoon, evening 중 true 개수)
          const morning = metadata.morning || false;
          const afternoon = metadata.afternoon || false;
          const evening = metadata.evening || false;
          const intakeCount = [morning, afternoon, evening].filter(Boolean).length;

          // 권장 섭취량
          const recommendedCount = productInfo.frequencyPerDay;

          // 최대값 제한 (섭취량이 권장량보다 많으면 권장량으로 제한)
          const actualIntakeCount = Math.min(intakeCount, recommendedCount);

          return {
            productId: metadata.productId,
            productName: productInfo.name,
            intakeCount: actualIntakeCount,
            recommendedCount: recommendedCount,
            displayOrder, // 정렬용
          };
        });

      // display_order 순서로 정렬 후 displayOrder 필드 제거
      supplementList.sort((a, b) => a.displayOrder - b.displayOrder);
      return supplementList.map(({ displayOrder, ...rest }) => rest);
    } catch (error) {
      this.logger.error('영양제 기록 변환 실패', error);
      return [];
    }
  }

  /**
   * 루틴 편집 화면용 전체 영양제 목록 조회
   * - 전체 영양제 목록 조회
   * - 내 루틴 포함 여부 표시
   * - 정렬: 1) 내 루틴, 2) 메타드림/리셋데이, 3) 나머지 ㄱㄴㄷ순
   */
  async getSupplementRoutineForEdit(userId: number) {
    try {
      this.logger.log(`루틴 편집용 영양제 목록 조회 시작: userId=${userId}`);

      // 1. 내 루틴 조회
      const myRoutine = await this.prisma.userSupplementRoutine.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          productId: true,
          isDefault: true,
          displayOrder: true,
        },
      });

      // productId별 루틴 정보 매핑
      const routineMap = new Map<
        number,
        { isDefault: boolean; displayOrder: number }
      >(
        myRoutine.map((r) => [
          r.productId,
          { isDefault: r.isDefault, displayOrder: r.displayOrder },
        ]),
      );

      // 2. 전체 영양제 목록 조회 (영양제 카테고리 + status='ACTIVE')
      const allProducts = await this.prisma.product.findMany({
        where: {
          categoryCode: 'SUPPLEMENT',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          productInfo: true,
          productFiles: {
            where: { imageType: 'MAIN' },
            include: { file: true },
            orderBy: { sortOrder: 'asc' },
            take: 1,
          },
        },
      });

      // 3. 응답 데이터 변환 및 그룹 지정
      const supplements = allProducts.map((product) => {
        const routineInfo = routineMap.get(product.id);
        const isInMyRoutine = !!routineInfo;
        const isDefault = routineInfo?.isDefault || false;

        // 그룹 결정
        let groupOrder = 3; // 기본: 나머지
        if (isInMyRoutine) {
          groupOrder = 1; // 내 루틴
        } else if (
          product.name === '메타드림' ||
          product.name === '리셋데이'
        ) {
          groupOrder = 2; // 메타드림/리셋데이
        }

        return {
          productId: product.id,
          productName: product.name,
          productImage: product.productFiles[0]?.file.filePath || null,
          dosage: product.productInfo
            ? {
                frequency: product.productInfo['frequency_per_day'] || 0,
                quantity: product.productInfo['quantity_per_dose'] || 0,
                unit: product.productInfo['unit'] || '정',
              }
            : { frequency: 0, quantity: 0, unit: '정' },
          isInMyRoutine,
          isDefault,
          groupOrder,
          displayOrder: routineInfo?.displayOrder || 999, // 내 루틴만 displayOrder 있음
        };
      });

      // 4. 정렬
      // 1순위: groupOrder (1 > 2 > 3)
      // 2순위: 1그룹은 isDefault (true > false) 후 displayOrder, 2그룹은 메타드림>리셋데이 고정, 3그룹은 이름 ㄱㄴㄷ순
      supplements.sort((a, b) => {
        if (a.groupOrder !== b.groupOrder) {
          return a.groupOrder - b.groupOrder;
        }

        if (a.groupOrder === 1) {
          // 내 루틴: isDefault 먼저 (기본 영양제 > 사용자 추가), 그 다음 displayOrder
          if (a.isDefault !== b.isDefault) {
            return a.isDefault ? -1 : 1; // true가 먼저
          }
          return a.displayOrder - b.displayOrder;
        }

        if (a.groupOrder === 2) {
          // 메타드림/리셋데이: 고정 순서 (메타드림 > 리셋데이)
          if (a.productName === '메타드림') return -1;
          if (b.productName === '메타드림') return 1;
          return 0;
        }

        // 3그룹: 이름 ㄱㄴㄷ순
        return a.productName.localeCompare(b.productName, 'ko');
      });

      // displayOrder 필드 제거 (응답에 불필요)
      const result = supplements.map(({ displayOrder, ...rest }) => rest);

      this.logger.log(
        `루틴 편집용 영양제 목록 조회 완료: 총 ${result.length}개`,
      );

      return result;
    } catch (error) {
      this.logger.error('루틴 편집용 영양제 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 영양제 루틴 저장 (추가/삭제)
   * 페이즈 1: user_supplement_routine 테이블 수정
   * - 기본 영양제(isDefault=true)는 유지
   * - 기존 사용자 추가 영양제(isDefault=false) 삭제
   * - 새로운 productIds로 사용자 추가 영양제 생성
   * - displayOrder 자동 계산 (기본 영양제 뒤에 배치)
   *
   * 페이즈 2: user_records 테이블 동기화 (오늘 ~ 미래 날짜)
   * - 오늘: 루틴에 있는데 기록 없으면 INSERT, 루틴에 없는데 기록 있으면 DELETE (단, 섭취 체크한 기록은 삭제 금지)
   * - 오늘 이후: 루틴에 있는데 기록 없으면 INSERT, 루틴에 없으면 무조건 DELETE
   */
  async saveSupplementRoutine(userId: number, productIds: number[]) {
    try {
      this.logger.log(
        `영양제 루틴 저장 시작: userId=${userId}, productIds=${productIds.join(', ')}`,
      );

      const today = getKoreanToday(); // KST 기준 오늘 날짜 (YYYY-MM-DD)

      const result = await this.prisma.$transaction(async (tx) => {
        const now = getNowKST();
        const todayDate = new Date(today);

        // ============ 페이즈 1: user_supplement_routine 수정 ============

        // 1. 기본 영양제 조회 (displayOrder 계산용 + 중복 제거용)
        const defaultRoutines = await tx.userSupplementRoutine.findMany({
          where: {
            userId,
            isDefault: true,
            isActive: true,
          },
          select: {
            productId: true,
          },
        });

        const defaultProductIds = new Set(
          defaultRoutines.map((r) => r.productId),
        );
        const defaultRoutineCount = defaultRoutines.length;

        // 2. 기존 사용자 추가 영양제 삭제 (isDefault=false만)
        const deletedRoutineCount = await tx.userSupplementRoutine.deleteMany({
          where: {
            userId,
            isDefault: false,
          },
        });

        this.logger.log(
          `[페이즈1] 기존 사용자 추가 영양제 ${deletedRoutineCount.count}개 삭제`,
        );

        // 3. 새로운 사용자 추가 영양제 생성 (기본 영양제 제외)
        const userAddedProductIds = productIds.filter(
          (id) => !defaultProductIds.has(id),
        );

        if (userAddedProductIds.length > 0) {
          await tx.userSupplementRoutine.createMany({
            data: userAddedProductIds.map((productId, index) => ({
              userId,
              productId,
              isDefault: false,
              displayOrder: defaultRoutineCount + index + 1, // 기본 영양제 뒤에 배치
              isActive: true,
              createdAt: now,
            })),
          });

          this.logger.log(
            `[페이즈1] 새로운 사용자 추가 영양제 ${userAddedProductIds.length}개 생성 (기본 영양제 ${defaultProductIds.size}개 제외)`,
          );
        }

        // ============ 페이즈 2: user_records 동기화 ============

        // 4. 최종 루틴 전체 조회 (기본 영양제 + 사용자 추가 영양제)
        const finalRoutine = await tx.userSupplementRoutine.findMany({
          where: {
            userId,
            isActive: true,
          },
          select: {
            productId: true,
          },
        });

        const routineProductIds = new Set<number>(
          finalRoutine.map((r) => r.productId),
        );

        this.logger.log(
          `[페이즈2] 최종 루틴 영양제: ${Array.from(routineProductIds).join(', ')}`,
        );

        // 5. 오늘 이후 날짜의 user_records 조회 (date >= 오늘)
        const futureRecords = await tx.userRecord.findMany({
          where: {
            userId,
            recordType: 'SUPPLEMENT',
            date: {
              gte: todayDate,
            },
          },
        });

        this.logger.log(
          `[페이즈2] 오늘 이후 영양제 기록: ${futureRecords.length}개`,
        );

        // 날짜별, productId별로 그룹화
        const recordsByDateAndProduct = new Map<
          string,
          Map<number, { id: number; morning: boolean; afternoon: boolean; evening: boolean }>
        >();

        futureRecords.forEach((record) => {
          const dateStr = record.date.toISOString().split('T')[0];
          const metadata = record.metadata as any;
          const productId = metadata?.productId as number;

          if (!productId) return;

          if (!recordsByDateAndProduct.has(dateStr)) {
            recordsByDateAndProduct.set(dateStr, new Map());
          }

          recordsByDateAndProduct.get(dateStr)!.set(productId, {
            id: record.id,
            morning: metadata.morning || false,
            afternoon: metadata.afternoon || false,
            evening: metadata.evening || false,
          });
        });

        let insertCount = 0;
        let deleteCount = 0;

        // 6. 날짜별로 동기화 처리
        // 오늘 날짜가 dateKeys에 없으면 추가 (기존 기록이 없어도 오늘 날짜는 처리해야 함)
        const dateKeys = Array.from(recordsByDateAndProduct.keys());
        if (!dateKeys.includes(today)) {
          dateKeys.push(today);
          recordsByDateAndProduct.set(today, new Map());
        }
        dateKeys.sort();

        for (const dateStr of dateKeys) {
          const isToday = dateStr === today;
          const recordDate = new Date(dateStr);
          const recordsMap = recordsByDateAndProduct.get(dateStr)!;

          // 6-1. 루틴에 있는데 기록 없으면 INSERT (최대 10개 제한)
          let dailyInsertCount = 0;
          const currentRecordCount = recordsMap.size;

          for (const productId of routineProductIds) {
            if (!recordsMap.has(productId)) {
              // 1일 최대 10개 영양제 제한
              if (currentRecordCount + dailyInsertCount >= 10) {
                this.logger.warn(
                  `[페이즈2] 날짜 ${dateStr} 영양제 기록 10개 제한 도달, 추가 INSERT 스킵`,
                );
                break; // 더 이상 INSERT 안 함
              }

              await tx.userRecord.create({
                data: {
                  userId,
                  recordType: 'SUPPLEMENT',
                  date: recordDate,
                  metadata: {
                    productId,
                    morning: false,
                    afternoon: false,
                    evening: false,
                  },
                  createdAt: now,
                },
              });
              insertCount++;
              dailyInsertCount++;
            }
          }

          // 6-2. 루틴에 없는데 기록 있으면 DELETE
          for (const [productId, record] of recordsMap.entries()) {
            if (!routineProductIds.has(productId)) {
              // 오늘 날짜: 섭취 체크한 기록은 삭제 금지
              if (isToday) {
                const hasIntake =
                  record.morning || record.afternoon || record.evening;
                if (hasIntake) {
                  this.logger.log(
                    `[페이즈2] 오늘 날짜 섭취 기록 삭제 스킵: productId=${productId}`,
                  );
                  continue; // 삭제하지 않음
                }
              }

              // 오늘 이후 또는 섭취 체크 안 한 오늘 기록: 삭제
              await tx.userRecord.delete({
                where: { id: record.id },
              });
              deleteCount++;
            }
          }
        }

        this.logger.log(
          `[페이즈2] user_records 동기화 완료: INSERT ${insertCount}개, DELETE ${deleteCount}개`,
        );

        return {
          message: '영양제 루틴이 저장되었습니다.',
          routine: {
            addedCount: userAddedProductIds.length,
            deletedCount: deletedRoutineCount.count,
          },
          records: {
            insertCount,
            deleteCount,
          },
        };
      });
    } catch (error) {
      this.logger.error('영양제 루틴 저장 실패', error);
      throw error;
    }
  }

}