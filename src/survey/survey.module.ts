import { Module } from '@nestjs/common';
import { SurveyService } from './survey.service';
import { SurveyMasterService } from './survey-master.service';
import { SurveyController } from './survey.controller';
import { EventModule } from '../event/event.module';

/**
 * 설문 모듈
 * 설문 관리와 관련된 모든 컴포넌트를 관리하는 모듈
 * 
 * 포함 컴포넌트:
 * - SurveyController: 설문 관련 HTTP 요청 처리
 * - SurveyService: 설문 비즈니스 로직 처리
 * - PrismaService: 데이터베이스 연결 및 쿼리 처리
 * 
 * 관리하는 엔티티:
 * - SurveyQuestion: 설문 질문
 * - SurveyOption: 설문 선택지
 * - SurveyAnswer: 사용자 설문 답변
 */
@Module({
  imports: [EventModule],
  controllers: [SurveyController],
  providers: [SurveyService, SurveyMasterService],
  exports: [SurveyService, SurveyMasterService], // 다른 모듈에서 서비스를 사용할 수 있도록 내보냄
})
export class SurveyModule {}