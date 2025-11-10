import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';
import { MissionModule } from '../mission/mission.module';
import { SurveyModule } from '../survey/survey.module';
import { QuizModule } from '../quiz/quiz.module';
import { ContentModule } from '../content/content.module';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyService } from './services/api-key.service';
import { ManagementUsersController } from './controllers/management-users.controller';
import { ManagementSurveyController } from './controllers/management-survey.controller';
import { ManagementApiKeyController } from './controllers/management-api-key.controller';
import { ManagementQuizMasterController } from './controllers/management-quiz-master.controller';
import { ManagementContentController } from './controllers/management-content.controller';
import { ManagementPointController } from './controllers/management-point.controller';
import { ManagementShopController } from './controllers/management-shop.controller';
import { ManagementDashboardController } from './controllers/management-dashboard.controller';
import { ManagementShippingController } from './controllers/management-shipping.controller';
import { ManagementRefundController } from './controllers/management-refund.controller';
import { ManagementChallengeController } from './controllers/management-challenge.controller';
import { ManagementMissionController } from './controllers/management-mission.controller';
import { ManagementShopService } from './services/management-shop.service';
import { ManagementDashboardService } from './services/management-dashboard.service';
import { ManagementShippingService } from './services/management-shipping.service';
import { ManagementRefundService } from './services/management-refund.service';
import { ManagementSurveyService } from './services/management-survey.service';
import { ManagementMissionService } from './services/management-mission.service';
import { PointModule } from '../point/point.module';
import { ChallengeModule } from '../challenge/challenge.module';
import { PaymentModule } from '../shop/payment.module';

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
    QuizModule,
    ContentModule,
    PointModule,
    ChallengeModule,
    PaymentModule,
  ],
  controllers: [
    ManagementUsersController,
    ManagementSurveyController,
    ManagementApiKeyController,
    ManagementQuizMasterController,
    ManagementContentController,
    ManagementPointController,
    ManagementShopController,
    ManagementDashboardController,
    ManagementShippingController,
    ManagementRefundController,
    ManagementChallengeController,
    ManagementMissionController,
  ],
  providers: [
    ApiKeyGuard,
    ApiKeyService,
    ManagementSurveyService,
    ManagementMissionService,
    ManagementShopService,
    ManagementDashboardService,
    ManagementShippingService,
    ManagementRefundService,
  ],
  exports: [ApiKeyGuard],
})
export class ManagementModule {}