import { Module } from '@nestjs/common';
import { BatchLogsController } from './batch-logs.controller';
import { BatchLogsService } from './batch-logs.service';

@Module({
  controllers: [BatchLogsController],
  providers: [BatchLogsService],
  exports: [BatchLogsService],
})
export class BatchLogsModule {}
