import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PrismaService } from '../services/prisma.service';
import { PushEventService } from '../../push/services/push-event.service';
import { getNowKST } from '../utils/kst-date.util';

/**
 * LastSeen 인터셉터
 * 인증된 유저의 마지막 접속 시간을 자동으로 업데이트
 *
 * 용도: 24/48시간 미접속 푸시 알림 조건 평가 및 재예약
 */
@Injectable()
export class LastSeenInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushEventService: PushEventService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        // 비동기로 처리 (응답 지연 없음, fire-and-forget)
        this.updateLastSeen(context);
      }),
    );
  }

  private async updateLastSeen(context: ExecutionContext): Promise<void> {
    try {
      const request = context.switchToHttp().getRequest<Request>();
      const userId = (request as any).user?.id;

      if (!userId || typeof userId !== 'number') return;

      // 1. lastSeenAt 업데이트
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: getNowKST() },
      });

      // 2. 미접속 푸시 알림 재예약 (기존 취소 + 새로 예약)
      await this.pushEventService.handleUserAccess(userId);
    } catch {
      // 무시 (사용자 경험에 영향 없도록)
    }
  }
}
