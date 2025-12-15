import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BANKS, Bank } from '../constants/banks.constant';

/**
 * 공통 API 컨트롤러
 * - 은행 목록 등 공통 데이터 제공
 */
@ApiTags('공통')
@Controller('common')
export class CommonController {
  /**
   * 은행 목록 조회
   */
  @Get('banks')
  @ApiOperation({ summary: '은행 목록 조회' })
  @ApiResponse({
    status: 200,
    description: '은행 목록',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', example: '06' },
          name: { type: 'string', example: 'KB국민은행' },
        },
      },
    },
  })
  getBanks(): Bank[] {
    return BANKS;
  }
}
