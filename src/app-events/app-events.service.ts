import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateAppEventDto } from './dto/create-app-event.dto';

@Injectable()
export class AppEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAppEventDto) {
    return this.prisma.appEvent.create({
      data: {
        eventName: dto.eventName,
        userId: dto.userId,
        platform: dto.platform,
        params: dto.params,
      },
    });
  }
}
