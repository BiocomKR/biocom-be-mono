import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlayautoService } from './services/playauto.service';

@Module({
  imports: [HttpModule],
  providers: [PlayautoService],
  exports: [PlayautoService],
})
export class PlayautoModule {}
