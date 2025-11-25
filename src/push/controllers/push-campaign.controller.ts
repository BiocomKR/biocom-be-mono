/**
 * @deprecated 삭제 예정 - biocom-bo-api로 이전됨
 * 백오피스 API: /management/push/campaigns/* 사용
 * 이전 완료일: 2024-11-25
 */

// import {
//   Controller,
//   Get,
//   Param,
//   Query,
//   UseGuards,
//   ParseIntPipe,
// } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
// import { SkipThrottle } from '@nestjs/throttler';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { PushCampaignService } from '../services/push-campaign.service';
// import { CampaignQueryDto } from '../dto/campaign-query.dto';
// import { CampaignListResponseDto } from '../dto/campaign-response.dto';

// /**
//  * 푸시 알림 캠페인 컨트롤러
//  *
//  * 관리자 전용 캠페인 조회 API
//  */
// @ApiTags('푸시-캠페인')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard)
// @SkipThrottle()
// @Controller('push/admin/campaigns')
// export class PushCampaignController {
//   constructor(private readonly pushCampaignService: PushCampaignService) {}

//   /**
//    * 캠페인 목록 조회
//    */
//   @Get()
//   @ApiOperation({
//     summary: '캠페인 목록 조회',
//     description: '푸시 알림 캠페인 실행 내역을 조회합니다 (페이지네이션 지원)',
//   })
//   @ApiResponse({
//     status: 200,
//     description: '캠페인 목록 조회 성공',
//     type: CampaignListResponseDto,
//   })
//   async getCampaigns(@Query() query: CampaignQueryDto): Promise<CampaignListResponseDto> {
//     return await this.pushCampaignService.getCampaigns(query);
//   }

//   /**
//    * 캠페인 상세 조회
//    */
//   @Get(':id')
//   @ApiOperation({
//     summary: '캠페인 상세 조회',
//     description: '특정 캠페인의 상세 정보를 조회합니다 (로그 포함)',
//   })
//   @ApiParam({ name: 'id', description: '캠페인 ID' })
//   @ApiResponse({ status: 200, description: '캠페인 조회 성공' })
//   @ApiResponse({ status: 404, description: '캠페인을 찾을 수 없음' })
//   async getCampaignById(@Param('id', ParseIntPipe) id: number) {
//     return await this.pushCampaignService.getCampaignById(id);
//   }
// }
