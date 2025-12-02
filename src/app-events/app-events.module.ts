import { Module } from '@nestjs/common';
import { AppEventsController } from './app-events.controller';
import { AppEventsService } from './app-events.service';

/**
 * 앱 이벤트 모듈
 *
 * 앱에서 발생하는 이벤트를 DB에 기록하는 모듈
 */
@Module({
  controllers: [AppEventsController],
  providers: [AppEventsService],
  exports: [AppEventsService],
})
export class AppEventsModule {}
