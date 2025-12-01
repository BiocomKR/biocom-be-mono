import { Module } from '@nestjs/common';
import { OperatorsController } from './operators.controller';
import { OperatorsService } from './operators.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [OperatorsController],
  providers: [OperatorsService, PrismaService],
  exports: [OperatorsService],
})
export class OperatorsModule {}
