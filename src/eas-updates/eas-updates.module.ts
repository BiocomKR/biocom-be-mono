import { Module } from '@nestjs/common';
import { EasUpdatesController } from './eas-updates.controller';
import { EasUpdatesService } from './eas-updates.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [EasUpdatesController],
  providers: [EasUpdatesService],
})
export class EasUpdatesModule {}
