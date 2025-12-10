import { Module } from '@nestjs/common';
import { HealthTypeAnimalsController } from './health-type-animals.controller';
import { HealthTypeAnimalsService } from './health-type-animals.service';

/**
 * 건강 타입 동물 모듈
 * - 건강 타입 동물 CRUD
 * - 이미지 업로드 및 매핑 관리
 */
@Module({
  controllers: [HealthTypeAnimalsController],
  providers: [HealthTypeAnimalsService],
  exports: [HealthTypeAnimalsService],
})
export class HealthTypeAnimalsModule {}
