import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { PointService } from '../point/point.service';
import {
  CreateBeautyRecordDto,
  CreateDietRecordDto,
  CreateSupplementRecordDto,
  CreateFastingRecordDto,
  CreateSleepRecordDto,
  CreateActivityRecordDto,
} from './dto/records.dto';

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

      // 기본값: 오늘 날짜
      const targetDate = date || new Date().toISOString().split('T')[0];

      this.logger.log(`기록 목록 조회 - 사용자: ${userId}, 날짜: ${targetDate}, 타입: ${recordType || 'ALL'}`);

      const records = await this.prisma.userRecord.findMany({
        where: {
          userId,
          date: new Date(targetDate),
          ...(recordType && { recordCode: recordType }),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const result = records.map((record) => ({
        id: record.id,
        recordType: record.recordCode,
        date: record.date.toISOString().split('T')[0],
        metadata: record.metadata,
        createdAt: record.createdAt.toISOString(),
      }));

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
   * 이너뷰티 기록 저장
   * @param userId 사용자 ID
   * @param dto 이너뷰티 기록 데이터
   */
  async createBeautyRecord(userId: number, dto: CreateBeautyRecordDto) {
    const targetDate = dto.date || new Date().toISOString().split('T')[0];
    
    return this.createRecord(userId, 'BEAUTY', {
      date: targetDate,
      metadata: {
        responses: dto.responses,
        totalScore: Object.values(dto.responses).reduce((sum, score) => sum + score, 0),
      },
    });
  }

  /**
   * 식단 기록 저장
   * @param userId 사용자 ID
   * @param dto 식단 기록 데이터
   */
  async createDietRecord(userId: number, dto: CreateDietRecordDto) {
    const targetDate = dto.date || new Date().toISOString().split('T')[0];
    
    return this.createRecord(userId, 'DIET', {
      date: targetDate,
      metadata: {
        breakfast: dto.breakfast,
        lunch: dto.lunch,
        dinner: dto.dinner,
        mealsCount: [dto.breakfast, dto.lunch, dto.dinner].filter(Boolean).length,
      },
    });
  }

  /**
   * 영양제 섭취 기록 저장
   * @param userId 사용자 ID
   * @param dto 영양제 섭취 기록 데이터
   */
  async createSupplementRecord(userId: number, dto: CreateSupplementRecordDto) {
    const targetDate = dto.date || new Date().toISOString().split('T')[0];
    
    return this.createRecord(userId, 'SUPPLEMENT', {
      date: targetDate,
      metadata: {
        time: dto.time,
        supplements: dto.supplements,
        takenCount: dto.supplements.filter(s => s.taken).length,
        totalCount: dto.supplements.length,
      },
    });
  }

  /**
   * 간헐적 단식 기록 저장
   * @param userId 사용자 ID
   * @param dto 간헐적 단식 기록 데이터
   */
  async createFastingRecord(userId: number, dto: CreateFastingRecordDto) {
    const targetDate = dto.date || new Date().toISOString().split('T')[0];
    
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
    const targetDate = dto.date || new Date().toISOString().split('T')[0];
    
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
   * 활동 기록 저장
   * @param userId 사용자 ID
   * @param dto 활동 기록 데이터
   */
  async createActivityRecord(userId: number, dto: CreateActivityRecordDto) {
    const targetDate = dto.date || new Date().toISOString().split('T')[0];
    
    // 운동 종목 검증 (임시 주석 처리)
    const exerciseCodes = dto.activities.map(a => a.exerciseCode);
    // TODO: ExerciseType 모델 수정 후 활성화
    // const validExercises = await this.prisma.exerciseType.findMany({
    //   where: {
    //     code: { in: exerciseCodes },
    //     isActive: true,
    //   },
    // });
    const validExercises = exerciseCodes.map(code => ({
      code,
      name: `${code} 운동`,
      calorieRate: 5.0
    }));
    
    if (validExercises.length !== exerciseCodes.length) {
      const invalidCodes = exerciseCodes.filter(code => 
        !validExercises.some(exercise => exercise.code === code)
      );
      throw new NotFoundException(`존재하지 않는 운동 종목이 포함되어 있습니다: ${invalidCodes.join(', ')}`);
    }
    
    // 총 운동 시간 계산
    const totalDuration = dto.activities.reduce((sum, activity) => sum + activity.duration, 0);
    
    // 칼로리 계산 (운동별 칼로리 계수 활용)
    let estimatedCalories = 0;
    for (const activity of dto.activities) {
      const exercise = validExercises.find(e => e.code === activity.exerciseCode);
      if (exercise?.calorieRate) {
        estimatedCalories += (exercise.calorieRate * activity.duration) / 60; // 시간당 → 분당 계산
      }
    }
    
    return this.createRecord(userId, 'ACTIVITY', {
      date: targetDate,
      metadata: {
        activities: dto.activities.map(activity => ({
          ...activity,
          exerciseName: validExercises.find(e => e.code === activity.exerciseCode)?.name,
        })),
        totalDuration,
        estimatedCalories: Math.round(estimatedCalories),
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
        // 1️⃣ 중복 기록 체크
        const existingRecord = await tx.userRecord.findFirst({
          where: {
            userId,
            recordCode,
            date: new Date(date),
          },
        });

        if (existingRecord) {
          throw new ConflictException(`오늘 이미 ${recordCode} 기록을 완료했습니다`);
        }

        // 2️⃣ 활성 챌린지 확인
        const activeChallenge = await tx.userChallenge.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
          },
        });

        // 3️⃣ 기록 저장
        const userRecord = await tx.userRecord.create({
          data: {
            userId,
            userChallengeId: activeChallenge?.id || null,
            recordCode,
            date: new Date(date),
            metadata,
          },
        });

        // 4️⃣ 포인트 지급 (공통 PointService 사용)
        const pointsEarned = 100;
        await this.pointService.awardPointsInTransaction(
          tx, 
          userId, 
          pointsEarned, 
          `${recordCode} 기록 완료`,
          'RECORD_COMPLETION',
          userRecord.id
        );

        const result = {
          id: userRecord.id,
          recordType: recordCode,
          date,
          pointsEarned,
          metadata,
        };

        this.logger.log(`${recordCode} 기록 저장 완료 - 사용자: ${userId}, 포인트: ${pointsEarned}점 지급`);
        
        return {
          success: true,
          data: result,
          message: '포인트 100점 드렸어요!',
        };
      });
    } catch (error) {
      this.logger.error(`${recordCode} 기록 저장 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }


  /**
   * 운동 종목 목록 조회 (임시 구현)
   */
  async getExerciseTypes() {
    try {
      this.logger.log('운동 종목 목록 조회');
      
      // 데이터베이스에서 활성화된 운동 종목 조회 (임시 주석 처리)
      // TODO: ExerciseType 모델 수정 후 활성화
      // const exerciseTypes = await this.prisma.exerciseType.findMany({
      //   where: { isActive: true },
      //   orderBy: [
      //     { category: 'asc' },
      //     { sortOrder: 'asc' },
      //     { name: 'asc' },
      //   ],
      // });
      const exerciseTypes = [
        { code: 'WALKING', name: '걷기', category: '유산소', calorieRate: 3.5 },
        { code: 'RUNNING', name: '달리기', category: '유산소', calorieRate: 8.0 },
        { code: 'WEIGHT_TRAINING', name: '웨이트 트레이닝', category: '무산소', calorieRate: 6.0 },
      ];

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
}