import { Module } from '@nestjs/common';
import { AppEventsController } from './app-events.controller';
import { AppEventsService } from './app-events.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [AppEventsController],
  providers: [AppEventsService, PrismaService],
  exports: [AppEventsService],
})
export class AppEventsModule {}
