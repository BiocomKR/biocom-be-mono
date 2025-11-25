/**
 * @deprecated 삭제 예정 - biocom-bo-api로 이전됨
 * 백오피스 API: /management/push/* 사용
 * 이전 완료일: 2024-11-25
 */

// import {
//   Controller,
//   Post,
//   Get,
//   Body,
//   Query,
//   UseGuards,
// } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
// import { SkipThrottle } from '@nestjs/throttler';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { PushNotificationService } from '../services/push-notification.service';
// import { SendPushToUserDto } from '../dto/send-push-to-user.dto';
// import { SendPushToUsersDto } from '../dto/send-push-to-users.dto';
// import { SendPushToAllDto } from '../dto/send-push-to-all.dto';
// import { PushLogQueryDto } from '../dto/push-log-query.dto';
// import { PushLogListResponseDto } from '../dto/push-log-response.dto';

// /**
//  * 푸시 알림 관리자 컨트롤러
//  *
//  * 관리자 전용 푸시 알림 전송 및 조회 API
//  *
//  * TODO: 관리자 권한 체크 추가 필요 (RolesGuard)
//  */
// @ApiTags('푸시-관리자')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard)
// @SkipThrottle()
// @Controller('push/admin')
// export class PushNotificationAdminController {
//   constructor(
//     private readonly pushNotificationService: PushNotificationService,
//   ) {}

//   /**
//    * 특정 유저에게 푸시 전송 (관리자 전용)
//    *
//    * @param dto - 푸시 메시지 + 대상 유저 ID
//    * @returns 전송 결과
//    */
//   @Post('send-to-user')
//   @ApiOperation({
//     summary: '특정 유저에게 푸시 전송 (관리자)',
//     description: '지정한 유저의 모든 기기에 푸시를 전송합니다',
//   })
//   @ApiResponse({
//     status: 201,
//     description: '푸시 전송 성공',
//   })
//   async sendToUser(@Body() dto: SendPushToUserDto) {
//     const result = await this.pushNotificationService.sendToUser(
//       dto.userId,
//       {
//         title: dto.title,
//         body: dto.body,
//         imageUrl: dto.imageUrl,
//         data: dto.data,
//       },
//       dto.isTest ?? false,
//     );

//     return {
//       success: result.success,
//       message: result.message,
//       data: {
//         sentCount: result.sentCount,
//         failureCount: result.failureCount,
//       },
//     };
//   }

//   /**
//    * 여러 유저에게 푸시 전송 (관리자 전용)
//    *
//    * @param dto - 푸시 메시지 + 대상 유저 ID 배열
//    * @returns 전송 결과
//    */
//   @Post('send-to-users')
//   @ApiOperation({
//     summary: '여러 유저에게 푸시 전송 (관리자)',
//     description: '지정한 여러 유저에게 푸시를 전송합니다',
//   })
//   @ApiResponse({
//     status: 201,
//     description: '푸시 전송 성공',
//   })
//   async sendToUsers(@Body() dto: SendPushToUsersDto) {
//     const result = await this.pushNotificationService.sendToUsers(
//       dto.userIds,
//       {
//         title: dto.title,
//         body: dto.body,
//         imageUrl: dto.imageUrl,
//         data: dto.data,
//       },
//       dto.isTest ?? false,
//     );

//     return {
//       success: result.success,
//       message: result.message,
//       data: {
//         sentCount: result.sentCount,
//         failureCount: result.failureCount,
//       },
//     };
//   }

//   /**
//    * 전체 유저에게 푸시 전송 (관리자 전용)
//    *
//    * @param dto - 푸시 메시지 + 필터
//    * @returns 전송 결과
//    */
//   @Post('send-to-all')
//   @ApiOperation({
//     summary: '전체 유저에게 푸시 전송 (관리자)',
//     description: '모든 유저에게 푸시를 전송합니다 (공지사항 등)',
//   })
//   @ApiResponse({
//     status: 201,
//     description: '푸시 전송 성공',
//   })
//   async sendToAll(@Body() dto: SendPushToAllDto) {
//     const result = await this.pushNotificationService.sendToAll(
//       {
//         title: dto.title,
//         body: dto.body,
//         imageUrl: dto.imageUrl,
//         data: dto.data,
//       },
//       {
//         marketingEnabled: dto.marketingOnly,
//       },
//       dto.isTest ?? false,
//     );

//     return {
//       success: result.success,
//       message: result.message,
//       data: {
//         sentCount: result.sentCount,
//         failureCount: result.failureCount,
//       },
//     };
//   }

//   /**
//    * 푸시 로그 조회 (관리자 전용)
//    *
//    * @param query - 조회 조건 (페이지네이션, 필터)
//    * @returns 푸시 로그 목록
//    */
//   @Get('logs')
//   @ApiOperation({
//     summary: '푸시 로그 조회 (관리자)',
//     description: '푸시 알림 발송 로그를 조회합니다 (페이지네이션 지원)',
//   })
//   @ApiResponse({
//     status: 200,
//     description: '로그 조회 성공',
//     type: PushLogListResponseDto,
//   })
//   async getPushLogs(@Query() query: PushLogQueryDto): Promise<PushLogListResponseDto> {
//     return await this.pushNotificationService.getPushLogs(query);
//   }

//   /**
//    * 푸시 통계 조회 (관리자 전용)
//    *
//    * 대시보드용 집계 통계 API
//    *
//    * @param startDate - 시작 날짜 (YYYY-MM-DD)
//    * @param endDate - 종료 날짜 (YYYY-MM-DD)
//    * @returns 푸시 통계
//    */
//   @Get('stats')
//   @ApiOperation({
//     summary: '푸시 통계 조회 (관리자)',
//     description: '대시보드용 푸시 알림 통계를 조회합니다 (총 발송, 성공, 실패, 읽음). 날짜 필터 가능',
//   })
//   @ApiResponse({
//     status: 200,
//     description: '통계 조회 성공',
//   })
//   async getPushStats(
//     @Query('startDate') startDate?: string,
//     @Query('endDate') endDate?: string,
//     @Query('isTest') isTest?: boolean,
//   ) {
//     return await this.pushNotificationService.getPushStats(startDate, endDate, isTest);
//   }
// }
