/**
 * @deprecated 삭제 예정 - biocom-bo-api로 이전됨
 * 백오피스 API: /management/push/schedules/* 사용
 * 이전 완료일: 2024-11-25
 */

// import {
//   Controller,
//   Get,
//   Post,
//   Put,
//   Delete,
//   Patch,
//   Body,
//   Param,
//   Query,
//   UseGuards,
//   ParseIntPipe,
// } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
// import { SkipThrottle } from '@nestjs/throttler';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { PushScheduleService } from '../services/push-schedule.service';
// import { CreateScheduleDto } from '../dto/create-schedule.dto';
// import { UpdateScheduleDto } from '../dto/update-schedule.dto';
// import { ScheduleQueryDto } from '../dto/schedule-query.dto';

// /**
//  * 푸시 알림 스케줄 컨트롤러
//  *
//  * 관리자 전용 스케줄 CRUD API
//  */
// @ApiTags('푸시-스케줄')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard)
// @SkipThrottle()
// @Controller('push/admin/schedules')
// export class PushScheduleController {
//   constructor(private readonly pushScheduleService: PushScheduleService) {}

//   /**
//    * 스케줄 생성
//    */
//   @Post()
//   @ApiOperation({
//     summary: '스케줄 생성',
//     description: '새로운 푸시 알림 스케줄을 생성합니다',
//   })
//   @ApiResponse({ status: 201, description: '스케줄 생성 성공' })
//   async createSchedule(@Body() dto: CreateScheduleDto) {
//     return await this.pushScheduleService.createSchedule(dto);
//   }

//   /**
//    * 스케줄 목록 조회
//    */
//   @Get()
//   @ApiOperation({
//     summary: '스케줄 목록 조회',
//     description: '푸시 알림 스케줄 목록을 조회합니다 (페이지네이션 지원)',
//   })
//   @ApiResponse({ status: 200, description: '스케줄 목록 조회 성공' })
//   async getSchedules(@Query() query: ScheduleQueryDto) {
//     return await this.pushScheduleService.getSchedules(query);
//   }

//   /**
//    * 스케줄 상세 조회
//    */
//   @Get(':id')
//   @ApiOperation({
//     summary: '스케줄 상세 조회',
//     description: '특정 스케줄의 상세 정보를 조회합니다',
//   })
//   @ApiParam({ name: 'id', description: '스케줄 ID' })
//   @ApiResponse({ status: 200, description: '스케줄 조회 성공' })
//   @ApiResponse({ status: 404, description: '스케줄을 찾을 수 없음' })
//   async getScheduleById(@Param('id', ParseIntPipe) id: number) {
//     return await this.pushScheduleService.getScheduleById(id);
//   }

//   /**
//    * 스케줄 수정
//    */
//   @Put(':id')
//   @ApiOperation({
//     summary: '스케줄 수정',
//     description: '기존 스케줄을 수정합니다',
//   })
//   @ApiParam({ name: 'id', description: '스케줄 ID' })
//   @ApiResponse({ status: 200, description: '스케줄 수정 성공' })
//   @ApiResponse({ status: 404, description: '스케줄을 찾을 수 없음' })
//   async updateSchedule(
//     @Param('id', ParseIntPipe) id: number,
//     @Body() dto: UpdateScheduleDto,
//   ) {
//     return await this.pushScheduleService.updateSchedule(id, dto);
//   }

//   /**
//    * 스케줄 삭제
//    */
//   @Delete(':id')
//   @ApiOperation({
//     summary: '스케줄 삭제',
//     description: '스케줄을 삭제합니다',
//   })
//   @ApiParam({ name: 'id', description: '스케줄 ID' })
//   @ApiResponse({ status: 200, description: '스케줄 삭제 성공' })
//   @ApiResponse({ status: 404, description: '스케줄을 찾을 수 없음' })
//   async deleteSchedule(@Param('id', ParseIntPipe) id: number) {
//     return await this.pushScheduleService.deleteSchedule(id);
//   }

//   /**
//    * 스케줄 활성화/비활성화 토글
//    */
//   @Patch(':id/toggle')
//   @ApiOperation({
//     summary: '스케줄 활성화/비활성화',
//     description: '스케줄의 활성화 상태를 토글합니다',
//   })
//   @ApiParam({ name: 'id', description: '스케줄 ID' })
//   @ApiResponse({ status: 200, description: '토글 성공' })
//   @ApiResponse({ status: 404, description: '스케줄을 찾을 수 없음' })
//   async toggleSchedule(@Param('id', ParseIntPipe) id: number) {
//     return await this.pushScheduleService.toggleSchedule(id);
//   }
// }
