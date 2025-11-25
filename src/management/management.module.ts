import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyService } from './services/api-key.service';

// Controllers
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

// Internal Services
import { ManagementShopService } from './services/management-shop.service';
import { ManagementDashboardService } from './services/management-dashboard.service';
import { ManagementShippingService } from './services/management-shipping.service';
import { ManagementRefundService } from './services/management-refund.service';
import { ManagementSurveyService } from './services/management-survey.service';
import { ManagementMissionService } from './services/management-mission.service';
import { ManagementUsersService } from './services/management-users.service';
import { ManagementPointService } from './services/management-point.service';
import { ManagementQuizService } from './services/management-quiz.service';
import { ManagementContentService } from './services/management-content.service';
import { ManagementChallengeService } from './services/management-challenge.service';

/**
 * Management 모듈
 * 백오피스에서 사용하는 관리용 API들을 제공
 * API-KEY 기반 인증 사용
 *
 * 모든 서비스를 내부적으로 관리하여 외부 모듈 의존성 제거
 */
@Module({
  imports: [
    CommonModule, // PrismaService 등 공통 서비스 제공
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
    // Guards & Utils
    ApiKeyGuard,
    ApiKeyService,
    // Internal Services
    ManagementSurveyService,
    ManagementMissionService,
    ManagementShopService,
    ManagementDashboardService,
    ManagementShippingService,
    ManagementRefundService,
    ManagementUsersService,
    ManagementPointService,
    ManagementQuizService,
    ManagementContentService,
    ManagementChallengeService,
  ],
  exports: [ApiKeyGuard],
})
export class ManagementModule {}
