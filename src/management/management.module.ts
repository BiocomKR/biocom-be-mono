import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';
import { MissionModule } from '../mission/mission.module';
import { SurveyModule } from '../survey/survey.module';
import { EventModule } from '../event/event.module';
import { QuizModule } from '../quiz/quiz.module';
import { ContentModule } from '../content/content.module';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyService } from './services/api-key.service';
import { ManagementUsersController } from './controllers/management-users.controller';
import { ManagementMissionController } from './controllers/management-mission.controller';
import { ManagementSurveyController } from './controllers/management-survey.controller';
import { ManagementApiKeyController } from './controllers/management-api-key.controller';
import { ManagementEventController } from './controllers/management-event.controller';
import { ManagementQuizMasterController } from './controllers/management-quiz-master.controller';
import { ManagementContentController } from './controllers/management-content.controller';

/**
 * Management 모듈
 * 백오피스에서 사용하는 관리용 API들을 제공
 * API-KEY 기반 인증 사용
 */
@Module({
  imports: [
    CommonModule,
    UsersModule,
    MissionModule,
    SurveyModule,
    EventModule,
    QuizModule,
    ContentModule,
  ],
  controllers: [
    ManagementUsersController,
    ManagementMissionController,
    ManagementSurveyController,
    ManagementApiKeyController,
    ManagementEventController,
    ManagementQuizMasterController,
    ManagementContentController,
  ],
  providers: [
    ApiKeyGuard,
    ApiKeyService,
  ],
  exports: [ApiKeyGuard],
})
export class ManagementModule {}