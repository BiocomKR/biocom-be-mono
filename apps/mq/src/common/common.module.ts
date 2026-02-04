import { Global, Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { RedisService } from './services/redis.service';

@Global()
@Module({
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class CommonModule {}
