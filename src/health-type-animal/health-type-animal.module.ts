import { Module } from '@nestjs/common';
import { HealthTypeAnimalController } from './health-type-animal.controller';
import { HealthTypeAnimalService } from './health-type-animal.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [HealthTypeAnimalController],
  providers: [HealthTypeAnimalService],
  exports: [HealthTypeAnimalService],
})
export class HealthTypeAnimalModule {}
