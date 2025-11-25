import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushCampaignService } from './services/push-campaign.service';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { CampaignListResponseDto } from './dto/campaign-response.dto';

/**
 * 푸시 캠페인 관리 컨트롤러
 * 백오피스 전용 캠페인 조회 API
 */
@UseGuards(JwtAuthGuard)
@SkipThrottle()
@Controller('management/push/campaigns')
export class PushCampaignController {
  constructor(private readonly pushCampaignService: PushCampaignService) {}

  /**
   * 캠페인 목록 조회
   */
  @Get()
  async getCampaigns(@Query() query: CampaignQueryDto): Promise<CampaignListResponseDto> {
    return await this.pushCampaignService.getCampaigns(query);
  }

  /**
   * 캠페인 상세 조회
   */
  @Get(':id')
  async getCampaignById(@Param('id', ParseIntPipe) id: number) {
    return await this.pushCampaignService.getCampaignById(id);
  }
}
