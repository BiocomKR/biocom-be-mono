import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Event } from '@prisma/client';
import { EventType, EventWithRelations, EventSurveyWithTypedOptions, EventSurveyOptions, isEventSurveyOptions } from './event.types';
import { PaginationHelper, PaginatedResult } from '../common/utils/pagination.util';

/**
 * 이벤트 관리 서비스
 * 챌린지, 프로모션, 캠페인 등 모든 기간 기반 이벤트 관리
 */
@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 현재 활성화된 이벤트 조회
   * 
   * @returns 활성 이벤트 정보
   * @throws NotFoundException 활성화된 이벤트가 없는 경우
   */
  async getActiveEvent(): Promise<EventWithRelations> {
    // 현재 날짜
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const period = await this.prisma.event.findFirst({
      where: { 
        isActive: true,
        startDate: {
          lte: today  // 시작일이 오늘 이전이거나 같음
        },
        endDate: {
          gte: today  // 종료일이 오늘 이후이거나 같음
        }
      },
      include: {
        eventSurveys: {
          include: {
            survey: {
              include: {
                surveyQuestions: {
                  orderBy: {
                    sortOrder: 'asc'
                  }
                }
              }
            }
          }
        },
        eventMissions: {
          include: {
            mission: true
          }
        },
        eventQuizzes: {
          include: {
            quiz: true
          }
        },
        eventContents: {
          include: {
            content: true
          },
          orderBy: {
            day: 'asc'
          }
        }
      }
    });
    
    if (!period) {
      this.logger.warn(`활성 이벤트를 찾을 수 없음 - 오늘 날짜: ${today.toISOString().split('T')[0]}`);
      throw new NotFoundException('현재 진행 중인 이벤트가 없습니다. (날짜 범위 또는 활성화 상태를 확인하세요)');
    }
    
    // surveyOptions 타입 변환
    const typedEventSurveys: EventSurveyWithTypedOptions[] = period.eventSurveys.map(es => ({
      ...es,
      surveyOptions: isEventSurveyOptions(es.surveyOptions) ? es.surveyOptions : null
    }));
    
    const result: EventWithRelations = {
      ...period,
      eventSurveys: typedEventSurveys
    };
    
    this.logger.log(`활성 이벤트 조회: ${period.name} (${period.startDate} ~ ${period.endDate})`);
    return result;
  }

  /**
   * 특정 날짜의 이벤트 일차 계산
   * 
   * @param dateStr 계산할 날짜 (YYYY-MM-DD)
   * @returns 이벤트 일차 (1~totalDays)
   * @throws BadRequestException 이벤트가 종료된 경우
   */
  async calculateEventDay(dateStr: string): Promise<number> {
    const period = await this.getActiveEvent();
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    
    // 일수 차이 계산
    const diffTime = targetDate.getTime() - period.startDate.getTime();
    const day = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // 이벤트 시작 전
    if (day <= 0) {
      this.logger.warn(`이벤트 시작 전 날짜 접근: ${dateStr} (이벤트 시작일: ${period.startDate})`);
      return 1; // 테스트를 위해 1일차로 반환
    }
    
    // 이벤트 종료 체크
    if (day > period.totalDays) {
      this.logger.warn(`이벤트 종료 후 접근: ${dateStr} (${day}일차, 총 ${period.totalDays}일)`);
      throw new BadRequestException(`이벤트가 종료되었습니다. (종료일: ${period.endDate})`);
    }
    
    this.logger.log(`이벤트 일차 계산: ${dateStr} = ${day}일차`);
    return day;
  }

  /**
   * 이벤트 상태 확인
   * 
   * @param dateStr 확인할 날짜
   * @returns 이벤트 상태 정보
   */
  async getEventStatus(dateStr: string): Promise<{
    isActive: boolean;
    currentDay: number | null;
    totalDays: number;
    startDate: Date;
    endDate: Date;
    name: string;
    isBeforeStart: boolean;
    isAfterEnd: boolean;
  }> {
    try {
      const period = await this.getActiveEvent();
      const targetDate = new Date(dateStr);
      targetDate.setHours(0, 0, 0, 0);
      const diffTime = targetDate.getTime() - period.startDate.getTime();
      const day = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      return {
        isActive: true,
        currentDay: day > 0 && day <= period.totalDays ? day : null,
        totalDays: period.totalDays,
        startDate: period.startDate,
        endDate: period.endDate,
        name: period.name,
        isBeforeStart: day <= 0,
        isAfterEnd: day > period.totalDays
      };
    } catch (error) {
      // 활성 이벤트가 없는 경우
      return {
        isActive: false,
        currentDay: null,
        totalDays: 21,
        startDate: new Date(),
        endDate: new Date(),
        name: '',
        isBeforeStart: false,
        isAfterEnd: false
      };
    }
  }

  /**
   * 새로운 이벤트 시작
   * 
   * @param data 이벤트 생성 데이터
   * @returns 생성된 이벤트
   */
  async startNewEvent(data: {
    name: string;
    startDate: string;
    totalDays?: number;
    description?: string;
    type?: EventType;
  }): Promise<Event> {
    const startDate = new Date(data.startDate);
    startDate.setHours(0, 0, 0, 0);
    const totalDays = data.totalDays || 21;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalDays - 1);
    
    // 트랜잭션으로 처리
    return await this.prisma.$transaction(async (tx) => {
      // 기존 활성 이벤트 비활성화
      await tx.event.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
      
      // 새 이벤트 생성
      const newPeriod = await tx.event.create({
        data: {
          name: data.name,
          startDate,
          endDate,
          totalDays,
          isActive: true,
          description: data.description,
          type: data.type || EventType.CHALLENGE
        }
      });
      
      this.logger.log(`새 이벤트 생성: ${newPeriod.name} (${newPeriod.startDate} ~ ${newPeriod.endDate})`);
      return newPeriod;
    });
  }

  /**
   * 모든 이벤트 목록 조회
   * 
   * @returns 이벤트 목록
   */
  async getAllEvents(): Promise<Event[]> {
    return await this.prisma.event.findMany({
      orderBy: { startDate: 'desc' }
    });
  }

  /**
   * 특정 이벤트 조회
   * 
   * @param id 이벤트 ID
   * @returns 이벤트 정보
   * @throws NotFoundException 이벤트를 찾을 수 없는 경우
   */
  async getEventById(id: number): Promise<EventWithRelations> {
    const period = await this.prisma.event.findUnique({
      where: { id },
      include: {
        eventSurveys: {
          include: {
            survey: {
              include: {
                surveyQuestions: {
                  orderBy: {
                    sortOrder: 'asc'
                  }
                }
              }
            }
          }
        },
        eventMissions: {
          include: {
            mission: true
          }
        },
        eventQuizzes: {
          include: {
            quiz: true
          }
        },
        eventContents: {
          include: {
            content: true
          },
          orderBy: {
            day: 'asc'
          }
        }
      }
    });
    
    if (!period) {
      throw new NotFoundException(`이벤트 기간을 찾을 수 없습니다: ${id}`);
    }
    
    // surveyOptions 타입 변환
    const typedEventSurveys: EventSurveyWithTypedOptions[] = period.eventSurveys.map(es => ({
      ...es,
      surveyOptions: isEventSurveyOptions(es.surveyOptions) ? es.surveyOptions : null
    }));
    
    return {
      ...period,
      eventSurveys: typedEventSurveys
    };
  }

  /**
   * 모든 활성화된 이벤트 조회
   * 
   * @returns 활성 이벤트 목록
   */
  async getAllActiveEvents(): Promise<EventWithRelations[]> {
    // 현재 날짜
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const periods = await this.prisma.event.findMany({
      where: { 
        isActive: true,
        startDate: {
          lte: today  // 시작일이 오늘 이전이거나 같음
        },
        endDate: {
          gte: today  // 종료일이 오늘 이후이거나 같음
        }
      },
      include: {
        eventSurveys: {
          include: {
            survey: {
              include: {
                surveyQuestions: {
                  orderBy: {
                    sortOrder: 'asc'
                  }
                }
              }
            }
          }
        },
        eventMissions: {
          include: {
            mission: true
          }
        },
        eventQuizzes: {
          include: {
            quiz: true
          }
        },
        eventContents: {
          include: {
            content: true
          },
          orderBy: {
            day: 'asc'
          }
        }
      },
      orderBy: [
        { startDate: 'desc' }  // 최신 순
      ]
    });
    
    if (periods.length === 0) {
      this.logger.warn(`활성 이벤트를 찾을 수 없음 - 오늘 날짜: ${today.toISOString().split('T')[0]}`);
      throw new NotFoundException('현재 진행 중인 이벤트가 없습니다. (날짜 범위 또는 활성화 상태를 확인하세요)');
    }
    
    // surveyOptions 타입 변환
    return periods.map(period => {
      const typedEventSurveys: EventSurveyWithTypedOptions[] = period.eventSurveys.map(es => ({
        ...es,
        surveyOptions: isEventSurveyOptions(es.surveyOptions) ? es.surveyOptions : null
      }));
      
      return {
        ...period,
        eventSurveys: typedEventSurveys
      };
    });
  }

  /**
   * 페이징 처리된 이벤트 목록 조회
   * 
   * @param page 페이지 번호
   * @param limit 페이지당 항목 수
   * @param filters 필터 조건
   * @param sort 정렬 조건
   * @returns 페이징 처리된 이벤트 목록
   */
  async getEventsWithPagination(
    page: number,
    limit: number,
    filters: {
      search?: string;
      type?: string;
      isActive?: boolean;
      startDate?: string;
      endDate?: string;
    },
    sort: {
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ): Promise<PaginatedResult<Event>> {
    this.logger.log(`페이징 처리된 이벤트 목록 조회 - page: ${page}, limit: ${limit}`);

    // WHERE 조건 구성
    const where: any = {};

    // 검색어 필터
    if (filters.search) {
      const searchCondition = PaginationHelper.createSearchCondition(filters.search, ['name', 'description']);
      if (searchCondition) {
        Object.assign(where, searchCondition);
      }
    }

    // 타입 필터
    if (filters.type) {
      where.type = filters.type;
    }

    // 활성화 상태 필터
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // 날짜 필터
    const startDateFilter = PaginationHelper.createDateFilter('startDate', { startDate: filters.startDate });
    const endDateFilter = PaginationHelper.createDateFilter('endDate', { endDate: filters.endDate });
    
    if (startDateFilter) Object.assign(where, startDateFilter);
    if (endDateFilter) Object.assign(where, endDateFilter);

    // 페이징 처리
    const result = await PaginationHelper.paginate<Event>(
      this.prisma.event,
      { page, limit },
      {
        where,
        include: {
          _count: {
            select: {
              eventUsers: true,
              eventMissions: true,
              eventSurveys: true,
              eventQuizzes: true
            },
          },
        },
      },
      sort
    );

    this.logger.log(`페이징 처리된 이벤트 목록 조회 완료 - 총 ${result.total}개, ${result.totalPages} 페이지`);

    return result;
  }

  /**
   * 이벤트 수정
   * 
   * @param id 이벤트 ID
   * @param data 수정할 데이터
   * @returns 수정된 이벤트
   */
  async updateEvent(
    id: number,
    data: Partial<{
      name: string;
      description: string;
      startDate: Date;
      endDate: Date;
      totalDays: number;
      isActive: boolean;
      type: EventType;
    }>
  ): Promise<Event> {
    this.logger.log(`이벤트 수정 - ID: ${id}`);

    // 이벤트 존재 확인
    const existing = await this.prisma.event.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundException(`이벤트를 찾을 수 없습니다: ${id}`);
    }

    // 날짜 변경 시 totalDays 재계산
    if (data.startDate || data.endDate) {
      const startDate = data.startDate || existing.startDate;
      const endDate = data.endDate || existing.endDate;
      const diffTime = endDate.getTime() - startDate.getTime();
      data.totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // 활성화 변경 시 다른 이벤트 비활성화
    if (data.isActive === true && !existing.isActive) {
      await this.prisma.event.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false }
      });
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data
    });

    this.logger.log(`이벤트 수정 완료 - ID: ${id}`);
    return updated;
  }

  /**
   * 이벤트 삭제
   * 
   * @param id 이벤트 ID
   */
  async deleteEvent(id: number): Promise<void> {
    this.logger.log(`이벤트 삭제 - ID: ${id}`);

    // 관련 데이터 확인
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        eventUsers: true,
        eventMissions: true,
        eventSurveys: true,
        eventQuizzes: {
          include: {
            quiz: true
          }
        }
      }
    });

    if (!event) {
      throw new NotFoundException(`이벤트를 찾을 수 없습니다: ${id}`);
    }

    // 관련 데이터가 있으면 경고
    if (event.eventUsers.length > 0) {
      throw new BadRequestException(`참여자가 있는 이벤트는 삭제할 수 없습니다. (참여자 수: ${event.eventUsers.length})`);
    }

    // 트랜잭션으로 관련 데이터 모두 삭제
    await this.prisma.$transaction(async (tx) => {
      // 이벤트 미션 삭제
      await tx.eventMission.deleteMany({
        where: { eventId: id }
      });

      // 이벤트 설문 삭제
      await tx.eventSurvey.deleteMany({
        where: { eventId: id }
      });

      // 이벤트 퀴즈 삭제
      await tx.eventQuiz.deleteMany({
        where: { eventId: id }
      });

      // 이벤트 삭제
      await tx.event.delete({
        where: { id }
      });
    });

    this.logger.log(`이벤트 삭제 완료 - ID: ${id}`);
  }

  // 하위 호환성을 위한 별칭 메서드들
  async calculateChallengeDay(dateStr: string): Promise<number> {
    return this.calculateEventDay(dateStr);
  }

  async getChallengeStatus(dateStr: string) {
    return this.getEventStatus(dateStr);
  }

  async startNewChallenge(data: any): Promise<Event> {
    return this.startNewEvent(data);
  }
}