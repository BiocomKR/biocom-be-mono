import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ConfigService } from '../services/config.service';

/**
 * 타임아웃 인터셉터
 * API 요청 처리 시간을 제한하여 응답 지연 방지
 * 
 * 기본 타임아웃: 30초
 * 파일 업로드 엔드포인트: 5분
 * 
 * 타임아웃 발생 시 RequestTimeoutException 발생
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly defaultTimeout: number;
  private readonly uploadTimeout: number;

  constructor(private readonly configService: ConfigService) {
    // 환경변수에서 타임아웃 설정 (기본값: 30초)
    this.defaultTimeout = parseInt(process.env.REQUEST_TIMEOUT || '30000', 10);
    // 파일 업로드용 타임아웃 (기본값: 5분)
    this.uploadTimeout = parseInt(process.env.UPLOAD_TIMEOUT || '300000', 10);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    
    // 엔드포인트별 타임아웃 설정
    let timeoutDuration = this.defaultTimeout;
    
    if (request.path.includes('/upload')) {
      timeoutDuration = this.uploadTimeout;
    } else if (request.path.includes('/export') || request.path.includes('/report')) {
      // 리포트 생성 등 시간이 오래 걸리는 작업
      timeoutDuration = 120000; // 2분
    }

    return next.handle().pipe(
      timeout(timeoutDuration),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException({
            message: '요청 처리 시간이 초과되었습니다.',
            error: 'Request Timeout',
            statusCode: 408,
            timeout: `${timeoutDuration / 1000}초`,
            path: request.path,
          });
        }
        return throwError(() => err);
      }),
    );
  }
}