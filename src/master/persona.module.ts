import { Module } from '@nestjs/common';
import { PersonaController } from './persona.controller';
import { PersonaService } from './persona.service';
import { CommonModule } from '../common/common.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [CommonModule, UploadModule],
  controllers: [PersonaController],
  providers: [PersonaService],
  exports: [PersonaService],
})
export class PersonaModule {}
