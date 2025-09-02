import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';

/**
 * 컨텐츠 모듈
 * 컨텐츠 마스터 데이터 관리 및 사용자 컨텐츠 완료
 */
@Module({
  imports: [CommonModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}