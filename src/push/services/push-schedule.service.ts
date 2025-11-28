/**
 * @deprecated - biocom-bo-api로 이전됨
 *
 * 이 서비스는 더 이상 사용되지 않습니다.
 * - CRUD 메서드: biocom-bo-api에서 처리
 * - getExecutableSchedules(): push-scheduler.service.ts로 이동됨
 *
 * 삭제 예정 파일입니다.
 */

// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from '../../common/services/prisma.service';
// import { getNowKST } from '../../common/utils/kst-date.util';
// import { PushScheduleType } from '../enums';

// @Injectable()
// export class PushScheduleService {
//   private readonly logger = new Logger(PushScheduleService.name);

//   constructor(private readonly prisma: PrismaService) {}

//   /**
//    * 실행 가능한 스케줄 조회 (배치용)
//    * → push-scheduler.service.ts로 이동됨
//    */
//   async getExecutableSchedules() {
//     try {
//       const now = getNowKST();

//       const onceSchedules = await this.prisma.pushNotificationSchedule.findMany({
//         where: {
//           isActive: true,
//           scheduleType: PushScheduleType.ONCE,
//           oneTimeScheduledAt: {
//             lte: now,
//           },
//         },
//       });

//       const recurringSchedules = await this.prisma.pushNotificationSchedule.findMany({
//         where: {
//           isActive: true,
//           scheduleType: PushScheduleType.RECURRING,
//           OR: [
//             { startDate: null, endDate: null },
//             { startDate: { lte: now }, endDate: null },
//             { startDate: null, endDate: { gte: now } },
//             { startDate: { lte: now }, endDate: { gte: now } },
//           ],
//         },
//       });

//       return [...onceSchedules, ...recurringSchedules];
//     } catch (error) {
//       this.logger.error(`❌ [PushScheduleService] 실행 가능한 스케줄 조회 실패: ${error.message}`, error.stack);
//       throw error;
//     }
//   }
// }
