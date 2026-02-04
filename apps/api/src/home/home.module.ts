import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { SibModule } from '../sib/sib.module';
import { MissionModule } from '../mission/mission.module';
import { AppConfigModule } from '../app-config/app-config.module';

/**
 * 홈 화면 모듈
 * 사용자의 구독 상태에 따른 홈 화면 데이터 제공
 */
@Module({
  imports: [SibModule, MissionModule, AppConfigModule],
  controllers: [HomeController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule {}