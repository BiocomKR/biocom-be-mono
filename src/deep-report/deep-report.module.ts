import { Module } from '@nestjs/common';
import { DeepReportController } from './deep-report.controller';
import { DeepReportService } from './deep-report.service';

/**
 * 심층리포트 모듈
 */
@Module({
  controllers: [DeepReportController],
  providers: [DeepReportService],
  exports: [DeepReportService],
})
export class DeepReportModule {}
