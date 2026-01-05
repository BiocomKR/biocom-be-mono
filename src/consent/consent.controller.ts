import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  Res,
  Header,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
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
   * 약관 코드로 단일 약관 조회 (Public API)
   * 앱스토어 제출용 개인정보처리방침 등 외부 공개용
   */
  @Get('public/consents/:code')
  @ApiOperation({
    summary: '약관 코드로 조회 (Public)',
    description: '약관 코드로 특정 약관을 조회합니다. 인증 없이 접근 가능합니다. (앱스토어 제출용)',
  })
  @ApiParam({
    name: 'code',
    description: '약관 코드 (예: PRIVACY_POLICY, SERVICE_TERMS)',
    example: 'PRIVACY_POLICY',
  })
  @ApiResponse({
    status: 200,
    description: '약관 조회 성공',
    schema: {
      example: {
        success: true,
        message: '약관을 조회했습니다.',
        data: {
          id: 1,
          code: 'PRIVACY_POLICY',
          title: '개인정보 처리방침',
          content: '제1조 (목적)...',
          version: '1.0',
          category: 'SIGNUP',
          isRequired: true,
        },
        timestamp: '2025-11-25T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '약관을 찾을 수 없음',
  })
  async getConsentByCode(@Param('code') code: string): Promise<ApiResponseDto> {
    const consent = await this.consentService.getConsentByCode(code);

    if (!consent) {
      throw new NotFoundException(`약관 '${code}'을(를) 찾을 수 없습니다.`);
    }

    return {
      success: true,
      message: '약관을 조회했습니다.',
      data: consent,
      timestamp: getNowKST(),
    };
  }

  /**
   * 약관 HTML 페이지 (Public)
   * 앱스토어 제출용 - 브라우저에서 바로 볼 수 있는 HTML
   */
  @Get('public/consents/:code/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: '약관 HTML 페이지 (Public)',
    description: '약관을 HTML 페이지로 렌더링합니다. 브라우저에서 바로 볼 수 있습니다. (앱스토어 제출용)',
  })
  @ApiParam({
    name: 'code',
    description: '약관 코드 (예: PRIVACY_POLICY, SERVICE_TERMS)',
    example: 'PRIVACY_POLICY',
  })
  @ApiResponse({
    status: 200,
    description: 'HTML 페이지 반환',
  })
  async getConsentHtml(
    @Param('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    const consent = await this.consentService.getConsentByCode(code);

    if (!consent) {
      res.status(404).send('<h1>404 - 약관을 찾을 수 없습니다.</h1>');
      return;
    }

    const contentHtml = (consent.content || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${consent.title} - 바이오컴</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #333; background: #fff; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 10px; color: #111; }
    .meta { color: #666; font-size: 14px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
    .content { font-size: 15px; }
    .content p { margin-bottom: 16px; }
    footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <h1>${consent.title}</h1>
  <div class="meta">버전 ${consent.version}</div>
  <div class="content"><p>${contentHtml}</p></div>
  <footer>© 주식회사 바이오컴</footer>
</body>
</html>`;

    res.send(html);
  }

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
