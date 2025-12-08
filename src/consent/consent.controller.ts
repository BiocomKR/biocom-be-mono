import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { ConsentService } from './consent.service';
import { UpdateUserConsentsDto } from './dto/update-user-consents.dto';
import { getNowKST } from '../common/utils/kst-date.util';

@ApiTags('약관')
@Controller()
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  /**
   * 활성 약관 목록 조회
   * 회원가입/약관 동의 화면에서 사용
   */
  @Get('consents')
  @ApiOperation({
    summary: '약관 목록 조회',
    description: '현재 활성화된 약관 목록을 조회합니다. category 파라미터로 특정 카테고리의 약관만 조회할 수 있습니다.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: '약관 카테고리 (예: SIGNUP, PAYMENT)',
    example: 'SIGNUP',
  })
  @ApiResponse({
    status: 200,
    description: '약관 목록 조회 성공',
    schema: {
      example: {
        success: true,
        message: '약관 목록을 조회했습니다.',
        data: [
          {
            id: 1,
            code: 'SERVICE_TERMS',
            title: '서비스 이용약관',
            content: '제1조 (목적)...',
            version: '1.0',
            category: 'SIGNUP',
            isRequired: true,
            displayOrder: 1,
          },
        ],
        timestamp: '2025-11-25T10:00:00.000Z',
      },
    },
  })
  async getConsents(
    @Query('category') category?: string,
  ): Promise<ApiResponseDto> {
    const consents = await this.consentService.getActiveConsents(category);

    return {
      success: true,
      message: '약관 목록을 조회했습니다.',
      data: consents,
      timestamp: getNowKST(),
    };
  }

  /**
   * 내 약관 동의 현황 조회
   */
  @Get('users/me/consents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 약관 동의 현황 조회',
    description: '현재 로그인한 사용자의 약관 동의 현황을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '약관 동의 현황 조회 성공',
    schema: {
      example: {
        success: true,
        message: '약관 동의 현황을 조회했습니다.',
        data: [
          {
            consentId: 1,
            code: 'SERVICE_TERMS',
            title: '서비스 이용약관',
            version: '1.0',
            isRequired: true,
            isAgreed: true,
            agreedAt: '2025-11-25T10:00:00.000Z',
          },
        ],
        timestamp: '2025-11-25T10:00:00.000Z',
      },
    },
  })
  async getMyConsents(@Request() req: any): Promise<ApiResponseDto> {
    const userId = req.user.sub;
    const consents = await this.consentService.getUserConsents(userId);

    return {
      success: true,
      message: '약관 동의 현황을 조회했습니다.',
      data: consents,
      timestamp: getNowKST(),
    };
  }

  /**
   * 약관 동의/철회 처리
   */
  @Post('users/me/consents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '약관 동의/철회',
    description: '약관에 대한 동의 또는 철회를 처리합니다. 필수 약관은 동의해야 합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '약관 동의 처리 성공',
    schema: {
      example: {
        success: true,
        message: '약관 동의가 처리되었습니다.',
        data: [
          {
            consentId: 1,
            code: 'SERVICE_TERMS',
            title: '서비스 이용약관',
            version: '1.0',
            isRequired: true,
            isAgreed: true,
            agreedAt: '2025-11-25T10:00:00.000Z',
          },
        ],
        timestamp: '2025-11-25T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '필수 약관 미동의',
  })
  async updateMyConsents(
    @Request() req: any,
    @Body() dto: UpdateUserConsentsDto,
  ): Promise<ApiResponseDto> {
    const userId = req.user.sub;
    const consents = await this.consentService.updateUserConsents(userId, dto);

    return {
      success: true,
      message: '약관 동의가 처리되었습니다.',
      data: consents,
      timestamp: getNowKST(),
    };
  }
}
