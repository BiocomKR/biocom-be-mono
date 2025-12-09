import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { PrismaService } from '../common/services/prisma.service';
import { SibModule } from '../sib/sib.module';

/**
 * 홈 화면 모듈
 * 사용자의 구독 상태에 따른 홈 화면 데이터 제공
 */
@Module({
  imports: [SibModule],
  controllers: [HomeController],
  providers: [HomeService, PrismaService],
  exports: [HomeService],
})
export class HomeModule {}