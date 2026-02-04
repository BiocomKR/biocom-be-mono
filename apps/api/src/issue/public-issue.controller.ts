import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IssueService } from './issue.service';
import { CreateAccountDeletionDto } from './dto/create-account-deletion.dto';

/**
 * 공개 API 컨트롤러 (인증 불필요)
 * 계정 삭제 요청 등 외부에서 접근 가능한 API
 */
@ApiTags('공개 API')
@Controller('public')
export class PublicIssueController {
  private readonly logger = new Logger(PublicIssueController.name);

  constructor(private readonly issueService: IssueService) {}

  /**
   * 계정 삭제 요청 접수 (Public API)
   * Google Play Console 요구사항 - 웹에서 계정 삭제 요청 가능해야 함
   */
  @Post('account-deletion')
  @ApiOperation({
    summary: '계정 삭제 요청 (Public)',
    description: '휴대폰 번호로 계정 삭제를 요청합니다. 인증 없이 접근 가능합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '삭제 요청 접수 성공',
    schema: {
      example: {
        success: true,
        message: '계정 삭제 요청이 접수되었습니다. 영업일 기준 7일 이내에 처리됩니다.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '유효하지 않은 요청',
  })
  async createAccountDeletionRequest(@Body() dto: CreateAccountDeletionDto) {
    this.logger.log(`계정 삭제 요청: mobile=${dto.mobile}`);
    return this.issueService.createAccountDeletionRequest(dto);
  }
}
