import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 내부 API 인증 가드
 *
 * 목적: biocom-bo-api 등 내부 서버에서 호출하는 API 인증
 * 인증방식: x-internal-api-key 헤더 검증
 */
@Injectable()
export class InternalApiGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiGuard.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('INTERNAL_API_KEY') || 'biocom-internal-api-key-2024';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-internal-api-key'];

    if (!providedKey) {
      this.logger.warn('내부 API 인증 실패: x-internal-api-key 헤더 없음');
      throw new UnauthorizedException('x-internal-api-key 헤더가 필요합니다.');
    }

    if (providedKey !== this.apiKey) {
      this.logger.warn('내부 API 인증 실패: 잘못된 API Key');
      throw new UnauthorizedException('유효하지 않은 API Key입니다.');
    }

    this.logger.log('내부 API 인증 성공');
    return true;
  }
}
