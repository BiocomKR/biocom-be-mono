import { Module } from '@nestjs/common';
import { IssueController } from './issue.controller';
import { PublicIssueController } from './public-issue.controller';
import { IssueService } from './issue.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [IssueController, PublicIssueController],
  providers: [IssueService, PrismaService],
  exports: [IssueService],
})
export class IssueModule {}
