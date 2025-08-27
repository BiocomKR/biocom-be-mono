import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';

/**
 * 컨텐츠 모듈
 * 컨텐츠 관리 기능을 제공하는 모듈
 */
@Module({
  imports: [CommonModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}