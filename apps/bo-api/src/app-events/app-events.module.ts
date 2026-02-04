import { Module } from '@nestjs/common';
import { AppEventsController } from './app-events.controller';
import { AppEventsService } from './app-events.service';

@Module({
  controllers: [AppEventsController],
  providers: [AppEventsService],
  exports: [AppEventsService],
})
export class AppEventsModule {}
