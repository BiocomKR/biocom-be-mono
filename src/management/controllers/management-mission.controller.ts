// import {
//   Controller,
//   Get,
//   Post,
//   Put,
//   Delete,
//   Param,
//   Query,
//   Body,
//   ParseIntPipe,
//   HttpStatus,
//   Logger,
//   UseGuards,
// } from '@nestjs/common';
// import { ApiKeyGuard } from '../guards/api-key.guard';
// import { ManagementMissionService } from '../services/management-mission.service';
// import { getNowKST } from '../../common/utils/kst-date.util';
// 
// /**
//  * Management 미션 관리 컨트롤러
//  * 백오피스에서 미션을 관리하는 API
//  */
// @Controller('management/missions')
// @UseGuards(ApiKeyGuard)
// export class ManagementMissionController {
//   private readonly logger = new Logger(ManagementMissionController.name);
// 
//   constructor(
//     private readonly managementMissionService: ManagementMissionService,
//   ) {}
// 
//   /**
//    * 모든 미션 목록 조회
//    */
//   @Get()
//   async getAllMissions(
//     @Query('page') page?: string,
//     @Query('limit') limit?: string,
//     @Query('type') type?: string,
//     @Query('category') category?: string,
//     @Query('search') search?: string,
//   ) {
//     this.logger.log(`미션 목록 조회 - 페이지: ${page}, 제한: ${limit}`);
//     
//     const missions = await this.managementMissionService.findAllMissions({
//       page: page ? parseInt(page) : 1,
//       limit: limit ? parseInt(limit) : 10,
//       type,
//       category,
//       search,
//     });
// 
//     return {
//       success: true,
//       message: '미션 목록 조회 성공',
//       data: missions,
//       timestamp: getNowKST(),
//     };
//   }
// 
//   /**
//    * 특정 미션 상세 조회
//    */
//   @Get(':id')
//   async getMissionById(
//     @Param('id', ParseIntPipe) id: number,
//   ) {
//     this.logger.log(`미션 상세 조회 - ID: ${id}`);
//     
//     const mission = await this.managementMissionService.findMissionById(id);
//     return {
//       success: true,
//       message: '미션 상세 조회 성공',
//       data: mission,
//       timestamp: getNowKST(),
//     };
//   }
// 
//   /**
//    * 새로운 미션 생성
//    */
//   @Post()
//   async createMission(
//     @Body() createMissionDto: {
//       code: string;
//       name: string;
//       description?: string;
//       points: number;
//       requireUpload?: boolean;
//       sortOrder?: number;
//       category?: string;
//       type?: string;
//       recordType?: string;
//       dailyLimit?: number;
//       specificDay?: number;
//       totalDays?: number;
//       uploadType?: string;
//       isActive?: boolean;
//     }
//   ) {
//     this.logger.log(`미션 생성 - 이름: ${createMissionDto.name}, dailyLimit: ${createMissionDto.dailyLimit || 1}`);
//     
//     const mission = await this.managementMissionService.createMission(createMissionDto);
//     return {
//       success: true,
//       message: '미션 생성 성공',
//       data: mission,
//       timestamp: getNowKST(),
//     };
//   }
// 
//   /**
//    * 미션 정보 수정
//    */
//   @Put(':id')
//   async updateMission(
//     @Param('id', ParseIntPipe) id: number,
//     @Body() updateMissionDto: {
//       code?: string;
//       name?: string;
//       description?: string;
//       points?: number;
//       requireUpload?: boolean;
//       sortOrder?: number;
//       category?: string;
//       type?: string;
//       recordType?: string;
//       dailyLimit?: number;
//       specificDay?: number;
//       totalDays?: number;
//       uploadType?: string;
//       isActive?: boolean;
//     }
//   ) {
//     this.logger.log(`미션 수정 - ID: ${id}, dailyLimit: ${updateMissionDto.dailyLimit}`);
//     
//     const mission = await this.managementMissionService.updateMission(id, updateMissionDto);
//     return {
//       success: true,
//       message: '미션 수정 성공',
//       data: mission,
//       timestamp: getNowKST(),
//     };
//   }
// 
//   /**
//    * 미션 삭제
//    */
//   @Delete(':id')
//   async deleteMission(
//     @Param('id', ParseIntPipe) id: number,
//   ) {
//     this.logger.log(`미션 삭제 - ID: ${id}`);
//     
//     await this.managementMissionService.deleteMission(id);
//     return {
//       success: true,
//       message: '미션 삭제 성공',
//       data: null,
//       timestamp: getNowKST(),
//     };
//   }
// 
//   /**
//    * 미션 활성/비활성 전환
//    */
//   @Put(':id/toggle-status')
//   async toggleMissionStatus(
//     @Param('id', ParseIntPipe) missionId: number,
//   ) {
//     this.logger.log(`미션 상태 전환 - 미션 ID: ${missionId}`);
//     
//     const mission = await this.managementMissionService.toggleMissionStatus(missionId);
//     return {
//       success: true,
//       message: '미션 상태 전환 성공',
//       data: mission,
//       timestamp: getNowKST(),
//     };
//   }
// 
//   /**
//    * 미션 dailyLimit 업데이트
//    */
//   @Put(':id/daily-limit')
//   async updateMissionDailyLimit(
//     @Param('id', ParseIntPipe) missionId: number,
//     @Body() body: { dailyLimit: number }
//   ) {
//     this.logger.log(`미션 dailyLimit 업데이트 - 미션 ID: ${missionId}, dailyLimit: ${body.dailyLimit}`);
//     
//     if (!body.dailyLimit || body.dailyLimit < 1) {
//       return {
//         success: false,
//         message: 'dailyLimit은 1 이상이어야 합니다',
//         data: null,
//         timestamp: getNowKST(),
//       };
//     }
//     
//     const mission = await this.managementMissionService.updateMissionDailyLimit(missionId, body.dailyLimit);
//     return {
//       success: true,
//       message: '미션 dailyLimit 업데이트 성공',
//       data: mission,
//       timestamp: getNowKST(),
//     };
//   }
// 
//   /**
//    * 미션 통계 조회
//    */
//   @Get(':id/stats')
//   async getMissionStats(
//     @Param('id', ParseIntPipe) missionId: number,
//   ) {
//     this.logger.log(`미션 통계 조회 - 미션 ID: ${missionId}`);
//     
//     const stats = await this.managementMissionService.getMissionStats(missionId);
//     return {
//       success: true,
//       message: '미션 통계 조회 성공',
//       data: stats,
//       timestamp: getNowKST(),
//     };
//   }
// }
