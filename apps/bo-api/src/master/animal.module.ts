import { Module } from '@nestjs/common';
import { AnimalController } from './animal.controller';
import { AnimalService } from './animal.service';
import { CommonModule } from '../common/common.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [CommonModule, UploadModule],
  controllers: [AnimalController],
  providers: [AnimalService],
  exports: [AnimalService],
})
export class AnimalModule {}
