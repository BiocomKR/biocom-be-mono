import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateScheduleDto } from '../dto/create-schedule.dto';
import { UpdateScheduleDto } from '../dto/update-schedule.dto';
import { ScheduleQueryDto } from '../dto/schedule-query.dto';
import { getNowKST, stringToKSTDate, parseKSTDateTime } from '../../common/utils/kst-date.util';

/**
 * 푸시 알림 스케줄 서비스
 *
 * 스케줄 CRUD 및 관리 로직
 */
@Injectable()
export class PushScheduleService {
  private readonly logger = new Logger(PushScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 스케줄 생성
   */
  async createSchedule(dto: CreateScheduleDto, createdBy?: number) {
    this.logger.log(`📋 [PushScheduleService] 스케줄 생성: name="${dto.name}", type=${dto.scheduleType}`);

    // 유효성 검증
    this.validateScheduleDto(dto);

    const schedule = await this.prisma.pushNotificationSchedule.create({
      data: {
        name: dto.name,
        description: dto.description,
        scheduleType: dto.scheduleType,
        type: dto.type,
        category: dto.category,
        cronExpression: dto.cronExpression,
        oneTimeScheduledAt: dto.oneTimeScheduledAt ? parseKSTDateTime(dto.oneTimeScheduledAt) : null,
        title: dto.title,
        bodyTemplate: dto.bodyTemplate,
        imageUrl: dto.imageUrl,
        data: dto.data,
        targetQuery: dto.targetQuery,
        startDate: dto.startDate ? stringToKSTDate(dto.startDate, 0, 0, 0) : null,
        endDate: dto.endDate ? stringToKSTDate(dto.endDate, 23, 59, 59) : null,
        isActive: dto.isActive ?? true,
        createdBy,
        createdAt: getNowKST(),
      },
    });

    this.logger.log(`✅ [PushScheduleService] 스케줄 생성 완료: id=${schedule.id}`);
    return schedule;
  }

  /**
   * 스케줄 목록 조회
   */
  async getSchedules(query: ScheduleQueryDto) {
    const { page = 1, limit = 20, scheduleType, category, isActive } = query;
    const skip = (page - 1) * limit;

    this.logger.log(`📋 [PushScheduleService] 스케줄 목록 조회: page=${page}, limit=${limit}`);

    // 필터 조건
    const where: any = {};
    if (scheduleType) where.scheduleType = scheduleType;
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;

    const [schedules, total] = await Promise.all([
      this.prisma.pushNotificationSchedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pushNotificationSchedule.count({ where }),
    ]);

    // 각 스케줄의 캠페인 통계 계산
    const schedulesWithStats = await Promise.all(
      schedules.map(async (schedule) => {
        const campaigns = await this.prisma.pushNotificationCampaign.findMany({
          where: { scheduleId: schedule.id },
          select: {
            status: true,
            sentCount: true,
            failCount: true,
          },
        });

        const totalExecutions = campaigns.length;
        const successfulExecutions = campaigns.filter(c => c.status === 'COMPLETED').length;
        const failedExecutions = campaigns.filter(c => c.status === 'FAILED').length;

        return {
          ...schedule,
          totalExecutions,
          successfulExecutions,
          failedExecutions,
        };
      })
    );

    this.logger.log(`✅ [PushScheduleService] 조회 완료: ${schedules.length}개 (전체: ${total}개)`);

    return {
      schedules: schedulesWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 스케줄 상세 조회
   */
  async getScheduleById(id: number) {
    this.logger.log(`📋 [PushScheduleService] 스케줄 상세 조회: id=${id}`);

    const schedule = await this.prisma.pushNotificationSchedule.findUnique({
      where: { id },
      include: {
        campaigns: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`스케줄을 찾을 수 없습니다: id=${id}`);
    }

    return schedule;
  }

  /**
   * 스케줄 수정
   */
  async updateSchedule(id: number, dto: UpdateScheduleDto) {
    this.logger.log(`📝 [PushScheduleService] 스케줄 수정: id=${id}`);

    // 존재 확인
    await this.getScheduleById(id);

    // 유효성 검증 (필드가 있는 경우만)
    if (dto.scheduleType || dto.cronExpression || dto.oneTimeScheduledAt) {
      const merged = { ...await this.getScheduleById(id), ...dto };
      this.validateScheduleDto(merged as any);
    }

    const updated = await this.prisma.pushNotificationSchedule.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.scheduleType && { scheduleType: dto.scheduleType }),
        ...(dto.type && { type: dto.type }),
        ...(dto.category && { category: dto.category }),
        ...(dto.cronExpression !== undefined && { cronExpression: dto.cronExpression }),
        ...(dto.oneTimeScheduledAt !== undefined && {
          oneTimeScheduledAt: dto.oneTimeScheduledAt ? parseKSTDateTime(dto.oneTimeScheduledAt) : null,
        }),
        ...(dto.title && { title: dto.title }),
        ...(dto.bodyTemplate && { bodyTemplate: dto.bodyTemplate }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.data !== undefined && { data: dto.data }),
        ...(dto.targetQuery !== undefined && { targetQuery: dto.targetQuery }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? stringToKSTDate(dto.startDate, 0, 0, 0) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? stringToKSTDate(dto.endDate, 23, 59, 59) : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: getNowKST(),
      },
    });

    this.logger.log(`✅ [PushScheduleService] 스케줄 수정 완료: id=${id}`);
    return updated;
  }

  /**
   * 스케줄 삭제
   */
  async deleteSchedule(id: number) {
    this.logger.log(`🗑️ [PushScheduleService] 스케줄 삭제: id=${id}`);

    // 존재 확인
    await this.getScheduleById(id);

    await this.prisma.pushNotificationSchedule.delete({
      where: { id },
    });

    this.logger.log(`✅ [PushScheduleService] 스케줄 삭제 완료: id=${id}`);
    return { success: true, message: '스케줄이 삭제되었습니다' };
  }

  /**
   * 스케줄 활성화/비활성화 토글
   */
  async toggleSchedule(id: number) {
    this.logger.log(`🔄 [PushScheduleService] 스케줄 토글: id=${id}`);

    const schedule = await this.getScheduleById(id);

    const updated = await this.prisma.pushNotificationSchedule.update({
      where: { id },
      data: {
        isActive: !schedule.isActive,
        updatedAt: getNowKST(),
      },
    });

    this.logger.log(`✅ [PushScheduleService] 스케줄 토글 완료: id=${id}, isActive=${updated.isActive}`);
    return updated;
  }

  /**
   * 스케줄 DTO 유효성 검증
   */
  private validateScheduleDto(dto: CreateScheduleDto | any) {
    if (dto.scheduleType === 'ONCE') {
      if (!dto.oneTimeScheduledAt) {
        throw new BadRequestException('ONCE 타입 스케줄은 oneTimeScheduledAt이 필수입니다');
      }
    } else if (dto.scheduleType === 'RECURRING') {
      if (!dto.cronExpression) {
        throw new BadRequestException('RECURRING 타입 스케줄은 cronExpression이 필수입니다');
      }
    }
  }

  /**
   * 실행 가능한 스케줄 조회 (배치용)
   *
   * @returns 현재 실행해야 할 스케줄 목록
   */
  async getExecutableSchedules() {
    const now = getNowKST();

    // ONCE 타입: oneTimeScheduledAt이 현재 시간보다 이전이고 isActive=true
    const onceSchedules = await this.prisma.pushNotificationSchedule.findMany({
      where: {
        isActive: true,
        scheduleType: 'ONCE',
        oneTimeScheduledAt: {
          lte: now,
        },
      },
    });

    // RECURRING 타입: isActive=true이고 startDate~endDate 범위 내
    const recurringSchedules = await this.prisma.pushNotificationSchedule.findMany({
      where: {
        isActive: true,
        scheduleType: 'RECURRING',
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
    });

    return [...onceSchedules, ...recurringSchedules];
  }
}
