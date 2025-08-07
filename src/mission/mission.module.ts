import { Module } from '@nestjs/common';
import { MissionController } from './mission.controller';
import { MissionService } from './mission.service';
import { MissionCompletionService } from './mission-completion.service';
import { QuizService } from './quiz.service';
import { QuizAnswerService } from './quiz-answer.service';
import { PrismaService } from '../common/services/prisma.service';
import { EventModule } from '../event/event.module';

@Module({
  imports: [EventModule],
  controllers: [MissionController],
  providers: [
    MissionService, 
    MissionCompletionService,
    QuizService, 
    QuizAnswerService,
    PrismaService
  ],
  exports: [
    MissionService, 
    MissionCompletionService,
    QuizService,
    QuizAnswerService
  ],
})
export class MissionModule {}