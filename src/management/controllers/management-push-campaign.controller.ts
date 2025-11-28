/**
 * @deprecated - biocom-bo-api로 이전됨
 * biocom-admin은 bo-api를 호출하므로 이 컨트롤러는 미사용
 */

// import {
//   Controller,
//   Get,
//   Param,
//   Query,
//   UseGuards,
//   ParseIntPipe,
// } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
// import { SkipThrottle } from '@nestjs/throttler';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { PushCampaignService } from '../../push/services/push-campaign.service';
// import { CampaignQueryDto } from '../../push/dto/campaign-query.dto';
// import { CampaignListResponseDto } from '../../push/dto/campaign-response.dto';

// /**
//  * 푸시 캠페인 관리 컨트롤러
//  *
//  * 백오피스 전용 캠페인 조회 API
//  * JWT 기반 인증 사용
//  *
//  * TODO: ApiKeyGuard로 변경 예정
//  */
// @ApiTags('Management-푸시')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard)
// @SkipThrottle()
// @Controller('management/push/campaigns')
// export class ManagementPushCampaignController {
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
