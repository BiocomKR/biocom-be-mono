import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PointService } from '../../point/point.service';
import { getKoreanToday } from '../../common/utils/korea-date.util';
import {
  CreateBeautyRecordDto,
  CreateDietRecordDto,
  CreateSupplementRecordDto,
  CreateFastingRecordDto,
  CreateSleepRecordDto,
  CreateActivityRecordDto,
  CreateCustomSupplementDto,
  CustomSupplementDto,
} from '../dto/records/records.dto';

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
  ) {}

  /**
   * 기록 목록 조회
   * @param userId 사용자 ID
   * @param filters 필터 옵션 (날짜, 기록 유형)
   */
  async getRecords(
    userId: number,
    filters: { date?: string; recordType?: string } = {}
  ) {
    try {
      const { date, recordType } = filters;

      // 기본값: 한국 시간 기준 오늘 날짜
      const targetDate = date || getKoreanToday();

      this.logger.log(`기록 목록 조회 - 사용자: ${userId}, 날짜: ${targetDate}, 타입: ${recordType || 'ALL'}`);
      this.logger.log(`🔥 기록 서비스 변환 모드 활성화됨!`);

      const records = await this.prisma.userRecord.findMany({
        where: {
          userId,
          date: targetDate, // String 직접 비교
          ...(recordType && { recordCode: recordType }),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // 각 기록 타입별로 형님이 원하는 형태로 변환
      this.logger.log(`기록 변환 시작 - 총 ${records.length}개 기록`);
      const result = await Promise.all(
        records.map(async (record) => {
          this.logger.log(`기록 변환 중: ${record.recordCode}, ID: ${record.id}`);
          const transformedMetadata = await this.transformRecordMetadata(record.recordCode, record.metadata, userId, record.date);
          this.logger.log(`변환 완료: ${record.recordCode}, 변환된 데이터:`, transformedMetadata);
          return {
            id: record.id,
            recordType: record.recordCode,
            date: record.date,
            metadata: transformedMetadata,
          };
        })
      );

      return {
        success: true,
        data: result,
        total: result.length,
      };
    } catch (error) {
      this.logger.error(`기록 목록 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 뷰티 기록 저장
   * @param userId 사용자 ID
   * @param dto 뷰티 기록 데이터 (이너뷰티 4개 + 아우터뷰티 4개)
   */
  async createBeautyRecord(userId: number, dto: CreateBeautyRecordDto) {
    const targetDate = dto.date || getKoreanToday();

    // 이너뷰티 점수 계산
    const innerBeautyScore = dto.innerBeauty.reduce((sum, item) => sum + item.score, 0);

    // 아우터뷰티 점수 계산
    const outerBeautyScore = dto.outerBeauty.reduce((sum, item) => sum + item.score, 0);

    return this.createRecord(userId, 'BEAUTY', {
      date: targetDate,
      metadata: {
        innerBeauty: dto.innerBeauty,
        outerBeauty: dto.outerBeauty,
        innerBeautyScore, // 이너뷰티 총점 (4-20점)
        outerBeautyScore, // 아우터뷰티 총점 (4-20점)
        totalScore: innerBeautyScore + outerBeautyScore, // 전체 총점 (8-40점)
      },
    });
  }

  /**
   * 식단 기록 저장 (새로운 구조)
   * @param userId 사용자 ID
   * @param dto 식단 기록 데이터 (단일 식품 등록)
   */
  async createDietRecord(userId: number, dto: CreateDietRecordDto) {
    const targetDate = dto.date || getKoreanToday();

    // 과민식품 개수 계산 (레벨과 무관하게 개수만)
    const allergyScore = dto.allergyFoods.length;

    // 고포드맵식품 개수
    const highFodmapCount = dto.highFodmapFoods.length;

    // 가공식품 개수
    const processedCount = dto.processedFoods.length;

    this.logger.log(`식단 기록 생성 - 사용자: ${userId}, 식품: ${dto.foodName}, 식사: ${dto.diet}`);

    return this.createRecord(userId, 'DIET', {
      date: targetDate,
      metadata: {
        diet: dto.diet,                    // 식사 종류 (BREAKFAST, LUNCH, etc.)
        foodName: dto.foodName,            // 식품명
        imageUrl: dto.imageUrl,            // 이미지 URL
        allergyFoods: dto.allergyFoods,    // 과민식품 배열 (name, level)
        highFodmapFoods: dto.highFodmapFoods, // 고포드맵식품 배열 (string[])
        processedFoods: dto.processedFoods,   // 가공식품 배열 (string[])
        // 통계용 계산된 값들
        allergyScore,      // 과민식품 점수 합계
        highFodmapCount,   // 고포드맵식품 개수
        processedCount,    // 가공식품 개수
      },
    });
  }

  /**
   * 영양제 섭취 기록 저장 (새로운 구조)
   * 복용시간 + 선택된 영양제 리스트 + 사진인증
   * @param userId 사용자 ID
   * @param dto 영양제 섭취 기록 데이터
   */
  async createSupplementRecord(userId: number, dto: CreateSupplementRecordDto) {
    const targetDate = dto.date || getKoreanToday();

    // 영양제 정보 검증 및 상세 정보 수집
    const supplementDetails = await Promise.all(
      dto.supplements.map(async (supplement) => {
        if (supplement.type === 'PRODUCT' && supplement.productId) {
          // 상품 테이블에서 영양제 정보 조회
          const product = await this.prisma.product.findUnique({
            where: { id: supplement.productId },
            select: { id: true, name: true }
          });

          if (!product) {
            throw new NotFoundException(`상품 ID ${supplement.productId}를 찾을 수 없습니다.`);
          }

          return {
            ...supplement,
            name: product.name, // 실제 상품명으로 업데이트
          };
        } else if (supplement.type === 'CUSTOM' && supplement.customSupplementId) {
          // 커스텀 영양제 테이블에서 정보 조회
          const customSupplement = await this.prisma.userCustomSupplement.findUnique({
            where: {
              id: supplement.customSupplementId,
              userId: userId, // 본인의 커스텀 영양제만 조회 가능
            },
            select: { id: true, name: true, dosage: true }
          });

          if (!customSupplement) {
            throw new NotFoundException(`커스텀 영양제 ID ${supplement.customSupplementId}를 찾을 수 없습니다.`);
          }

          return {
            ...supplement,
            name: customSupplement.name,
            dosage: customSupplement.dosage || supplement.dosage,
          };
        }

        return supplement;
      })
    );

    return this.createRecord(userId, 'SUPPLEMENT', {
      date: targetDate,
      metadata: {
        time: dto.time,
        supplements: supplementDetails,
        imageUrl: dto.imageUrl,
        takenCount: supplementDetails.filter(s => s.taken).length,
        totalCount: supplementDetails.length,
      },
    });
  }

  /**
   * 사용자 커스텀 영양제 목록 조회
   * @param userId 사용자 ID
   */
  async getCustomSupplements(userId: number): Promise<CustomSupplementDto[]> {
    this.logger.log(`커스텀 영양제 목록 조회 - 사용자: ${userId}`);

    const customSupplements = await this.prisma.userCustomSupplement.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return customSupplements.map(supplement => ({
      id: supplement.id,
      name: supplement.name,
      dosage: supplement.dosage,
      memo: supplement.memo,
      createdAt: supplement.createdAt.toISOString(),
    }));
  }

  /**
   * 커스텀 영양제 생성
   * @param userId 사용자 ID
   * @param dto 커스텀 영양제 데이터
   */
  async createCustomSupplement(userId: number, dto: CreateCustomSupplementDto): Promise<CustomSupplementDto> {
    this.logger.log(`커스텀 영양제 생성 - 사용자: ${userId}, 영양제명: ${dto.name}`);

    const customSupplement = await this.prisma.userCustomSupplement.create({
      data: {
        userId,
        name: dto.name,
        dosage: dto.dosage,
        memo: dto.memo,
      },
    });

    return {
      id: customSupplement.id,
      name: customSupplement.name,
      dosage: customSupplement.dosage,
      memo: customSupplement.memo,
      createdAt: customSupplement.createdAt.toISOString(),
    };
  }

  /**
   * 커스텀 영양제 삭제 (비활성화)
   * @param userId 사용자 ID
   * @param supplementId 커스텀 영양제 ID
   */
  async deleteCustomSupplement(userId: number, supplementId: number): Promise<void> {
    this.logger.log(`커스텀 영양제 삭제 - 사용자: ${userId}, 영양제 ID: ${supplementId}`);

    const customSupplement = await this.prisma.userCustomSupplement.findUnique({
      where: { id: supplementId },
    });

    if (!customSupplement) {
      throw new NotFoundException('커스텀 영양제를 찾을 수 없습니다.');
    }

    if (customSupplement.userId !== userId) {
      throw new ConflictException('본인의 커스텀 영양제만 삭제할 수 있습니다.');
    }

    await this.prisma.userCustomSupplement.update({
      where: { id: supplementId },
      data: { isActive: false },
    });
  }

  /**
   * 영양제 목록 조회 (상품 + 커스텀)
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
        images: {
          where: { imageType: 'MAIN' },
          select: { imageUrl: true },
          take: 1,
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // 사용자 커스텀 영양제 조회
    const customSupplements = await this.getCustomSupplements(userId);

    return {
      success: true,
      data: {
        products: products.map(product => ({
          id: product.id,
          type: 'PRODUCT',
          name: product.name,
          description: product.description,
          imageUrl: product.images[0]?.imageUrl,
        })),
        customSupplements: customSupplements.map(supplement => ({
          id: supplement.id,
          type: 'CUSTOM',
          name: supplement.name,
          dosage: supplement.dosage,
          memo: supplement.memo,
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
    const targetDate = dto.date || getKoreanToday();
    
    // 단식 시간 계산 (예시 로직)
    const startTime = new Date(`${targetDate} ${dto.startTime}`);
    const endTime = new Date(`${targetDate} ${dto.endTime}`);
    
    // 종료 시간이 다음날인 경우 처리
    if (endTime < startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }
    
    const fastingHours = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60) * 10) / 10;
    
    return this.createRecord(userId, 'FASTING', {
      date: targetDate,
      metadata: {
        startTime: dto.startTime,
        endTime: dto.endTime,
        fastingHours,
      },
    });
  }

  /**
   * 수면 기록 저장
   * @param userId 사용자 ID
   * @param dto 수면 기록 데이터
   */
  async createSleepRecord(userId: number, dto: CreateSleepRecordDto) {
    const targetDate = dto.date || getKoreanToday();
    
    // 수면 시간 계산
    const bedTime = new Date(`${targetDate} ${dto.bedTime}`);
    const wakeTime = new Date(`${targetDate} ${dto.wakeTime}`);
    
    // 기상 시간이 다음날인 경우 처리
    if (wakeTime < bedTime) {
      wakeTime.setDate(wakeTime.getDate() + 1);
    }
    
    const sleepHours = Math.round((wakeTime.getTime() - bedTime.getTime()) / (1000 * 60 * 60) * 10) / 10;
    
    return this.createRecord(userId, 'SLEEP', {
      date: targetDate,
      metadata: {
        bedTime: dto.bedTime,
        wakeTime: dto.wakeTime,
        sleepHours,
      },
    });
  }

  /**
   * 활동 기록 저장 (새로운 구조)
   * @param userId 사용자 ID
   * @param dto 활동 기록 데이터 (activityType, activityTime, imageUrl, date)
   */
  async createActivityRecord(userId: number, dto: CreateActivityRecordDto) {
    const targetDate = dto.date || getKoreanToday();

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

    // 칼로리 계산 (DB의 calorie_rate는 시간당 소모 칼로리)
    const estimatedCalories = Math.round((exerciseType.calorieRate || 0) * (durationInMinutes / 60));

    this.logger.log(`칼로리 계산: ${exerciseType.name} ${dto.activityTime} = ${estimatedCalories}kcal`);

    return this.createRecord(userId, 'ACTIVITY', {
      date: targetDate,
      metadata: {
        activityType: {
          code: exerciseType.code,
          name: exerciseType.name,
          category: exerciseType.category,
          calorie_rate: exerciseType.calorieRate,
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

      return await this.prisma.$transaction(async (tx) => {
        // 각 기록 타입별 구현으로 위임
        return await this.createRecordByType(tx, userId, recordCode, date, metadata);
      });
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
   * 뷰티 기록 구현 (중복 불허, 매번 포인트)
   */
  private async createBeautyRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    // 중복 체크
    const existingRecord = await tx.userRecord.findFirst({
      where: { userId, recordCode: 'BEAUTY', date },
    });

    if (existingRecord) {
      throw new ConflictException(`오늘 이미 BEAUTY 기록을 완료했습니다`);
    }

    return await this.createRecordBase(tx, userId, 'BEAUTY', date, metadata, 100);
  }

  /**
   * 식단 기록 구현 (중복 허용, 1일 1회 포인트)
   */
  private async createDietRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    // 포인트 지급 여부 확인 (해당 날짜에 첫 번째 기록인지)
    const existingDietRecord = await tx.userRecord.findFirst({
      where: { userId, recordCode: 'DIET', date },
    });

    const pointsToAward = existingDietRecord ? 0 : 100;

    return await this.createRecordBase(tx, userId, 'DIET', date, metadata, pointsToAward);
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
   * 간헐적단식 기록 구현 (중복 불허, 매번 포인트)
   */
  private async createFastingRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    // 중복 체크
    const existingRecord = await tx.userRecord.findFirst({
      where: { userId, recordCode: 'FASTING', date },
    });

    if (existingRecord) {
      throw new ConflictException(`오늘 이미 FASTING 기록을 완료했습니다`);
    }

    return await this.createRecordBase(tx, userId, 'FASTING', date, metadata, 100);
  }

  /**
   * 수면 기록 구현 (중복 불허, 매번 포인트)
   */
  private async createSleepRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    // 중복 체크
    const existingRecord = await tx.userRecord.findFirst({
      where: { userId, recordCode: 'SLEEP', date },
    });

    if (existingRecord) {
      throw new ConflictException(`오늘 이미 SLEEP 기록을 완료했습니다`);
    }

    return await this.createRecordBase(tx, userId, 'SLEEP', date, metadata, 100);
  }

  /**
   * 활동 기록 구현 (중복 허용, 1일 1회 포인트)
   */
  private async createActivityRecordImpl(tx: any, userId: number, date: string, metadata: any) {
    // 포인트 지급 여부 확인 (해당 날짜에 첫 번째 기록인지)
    const existingActivityRecord = await tx.userRecord.findFirst({
      where: { userId, recordCode: 'ACTIVITY', date },
    });

    const pointsToAward = existingActivityRecord ? 0 : 100;

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

    // 기록 저장
    const userRecord = await tx.userRecord.create({
      data: {
        userId,
        userChallengeId: activeChallenge?.id || null,
        recordCode,
        date,
        metadata,
      },
    });

    // 포인트 지급 (조건부)
    if (pointsToAward > 0) {
      await this.pointService.awardPointsInTransaction(
        tx,
        userId,
        pointsToAward,
        `${recordCode} 기록 완료`,
        'RECORD_COMPLETION',
        userRecord.id
      );
    }

    this.logger.log(`${recordCode} 기록 저장 완료 - 사용자: ${userId}, 포인트: ${pointsToAward}점 지급`);

    return {
      id: userRecord.id,
      recordType: recordCode,
      date,
      pointsEarned: pointsToAward,
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
        orderBy: [
          { category: 'asc' },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
      });

      // 카테고리별로 그룹핑
      const groupedTypes = exerciseTypes.reduce((groups, exercise) => {
        const category = exercise.category;
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push({
          code: exercise.code,
          name: exercise.name,
          calorieRate: exercise.calorieRate,
        });
        return groups;
      }, {} as Record<string, any[]>);

      return {
        success: true,
        data: groupedTypes,
      };
    } catch (error) {
      this.logger.error('운동 종목 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 기록 메타데이터를 형님이 원하는 형태로 변환
   * @param recordType 기록 타입
   * @param metadata 원본 메타데이터
   * @param userId 사용자 ID
   * @param date 기록 날짜
   */
  private async transformRecordMetadata(recordType: string, metadata: any, userId: number, date: string) {
    switch (recordType) {
      case 'BEAUTY':
        return this.transformBeautyMetadata(metadata, userId, date);
      case 'DIET':
        return this.transformDietMetadata(metadata);
      case 'SUPPLEMENT':
        return this.transformSupplementMetadata(metadata);
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
   */
  private async transformBeautyMetadata(metadata: any, userId: number, date: string) {
    // 이전 점수 조회 (전날 데이터)
    const yesterday = this.getPreviousDate(date);
    let scoreDiff = 0;

    try {
      const yesterdayRecord = await this.prisma.userRecord.findFirst({
        where: {
          userId,
          recordCode: 'BEAUTY',
          date: yesterday,
        },
      });

      if (yesterdayRecord && yesterdayRecord.metadata) {
        const yesterdayScore = yesterdayRecord.metadata?.totalScore || 0;
        scoreDiff = metadata.totalScore - yesterdayScore;
      }
    } catch (error) {
      this.logger.warn(`전날 이너뷰티 점수 조회 실패: ${error.message}`);
    }

    return {
      totalScore: metadata.totalScore,
      targetScore: 100, // TODO: 하드코딩 -> 실제 목표값으로 변경
      scoreDiff: scoreDiff,
    };
  }

  /**
   * 식단 메타데이터 변환
   */
  private transformDietMetadata(metadata: any) {
    const result: any = {};

    // 아침, 점심, 저녁, 간식, 야식 처리
    const mealTypes = [
      { key: 'breakfast', korean: '아침' },
      { key: 'lunch', korean: '점심' },
      { key: 'dinner', korean: '저녁' },
      { key: 'snack', korean: '간식' },
      { key: 'lateSnack', korean: '야식' },
    ];

    mealTypes.forEach(({ key, korean }) => {
      if (metadata[key] && metadata[key].foods && metadata[key].foods.length > 0) {
        result[key] = {
          name: metadata[key].foods[0].name,
          imageUrl: '', // TODO: 이미지 URL 처리 로직 추가
        };
      }
      // 안 먹은 식사는 객체 생성하지 않음
    });

    // dietScore 추가
    result.dietScore = 40; // TODO: 하드코딩 -> 실제 계산 로직으로 변경

    return result;
  }

  /**
   * 영양제 메타데이터 변환
   */
  private transformSupplementMetadata(metadata: any) {
    const complianceRate = metadata.totalCount > 0
      ? Math.round((metadata.takenCount / metadata.totalCount) * 100)
      : 0;

    return {
      takenCount: metadata.takenCount,
      targetCount: metadata.totalCount,
      complianceRate: complianceRate,
    };
  }

  /**
   * 간헐적 단식 메타데이터 변환
   */
  private transformFastingMetadata(metadata: any) {
    const fastingHours = metadata.fastingHours || 0;
    const fastingMinutes = 0; // 현재 시간 단위만 저장됨

    return {
      fastingHours: fastingHours,
      fastingMinutes: fastingMinutes,
      targetTime: 16, // TODO: 하드코딩 -> 실제 목표값으로 변경
    };
  }

  /**
   * 수면 메타데이터 변환
   */
  private transformSleepMetadata(metadata: any) {
    const sleepHours = metadata.sleepHours || 0;
    const sleepMinutes = 0; // 현재 시간 단위만 저장됨

    return {
      sleepHours: sleepHours,
      sleepMinutes: sleepMinutes,
      targetTime: 8, // TODO: 하드코딩 -> 실제 목표값으로 변경
    };
  }

  /**
   * 활동 메타데이터 변환
   */
  private transformActivityMetadata(metadata: any) {
    return {
      activityType: metadata.activityType,
      activityTime: metadata.activityTime,
      durationInMinutes: metadata.durationInMinutes,
      imageUrl: metadata.imageUrl,
      burnedCalories: metadata.estimatedCalories || 0,
      targetCalories: 800, // TODO: 하드코딩 -> 실제 목표값으로 변경
      // 기존 호환성 유지
      totalDuration: metadata.totalDuration || metadata.durationInMinutes || 0,
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
}