import {
  Controller,
  Post,
  Headers,
  Body,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiBody } from '@nestjs/swagger';
import { QueueService } from '../queues/queue.service';

@ApiTags('Batch')
@Controller('batch')
export class BatchController {
  private readonly logger = new Logger(BatchController.name);

  constructor(private readonly queueService: QueueService) {}

  @Post('allergy-sync')
  @ApiOperation({ summary: '알러지 데이터 동기화 트리거' })
  @ApiHeader({ name: 'X-Batch-Key', description: 'Batch API Key', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['full', 'incremental'],
          default: 'incremental',
        },
      },
    },
  })
  async triggerAllergySync(
    @Headers('x-batch-key') batchKey: string,
    @Body() body: { type?: 'full' | 'incremental' },
  ) {
    // API 키 검증
    const expectedKey = process.env.BATCH_API_KEY;
    if (!expectedKey || batchKey !== expectedKey) {
      this.logger.warn('Invalid batch API key attempt');
      throw new UnauthorizedException('Invalid batch API key');
    }

    const syncType = body.type || 'incremental';
    this.logger.log(`알러지 동기화 트리거 요청: syncType=${syncType}`);

    const job = await this.queueService.addAllergySync(syncType);

    return {
      success: true,
      message: `알러지 동기화 Job이 추가되었습니다.`,
      jobId: job.id,
      syncType,
    };
  }
}
