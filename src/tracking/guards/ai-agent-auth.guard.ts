import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { CryptoUtil } from '../../common/utils/crypto.util';

/**
 * AI Agent 인증 가드
 *
 * 목적: AI Agent 서버에서 호출하는 통계 API 인증
 * 인증방식: 헤더의 x-token에 암호화된 chartId를 전달받아 복호화
 * 암호화: AES-256-GCM 알고리즘 사용 (CryptoUtil.decrypt)
 *
 * 처리 순서:
 * 1. x-token 헤더에서 암호화된 chartId 추출
 * 2. AES-GCM으로 복호화 시도
 * 3. 복호화 성공 시 req.chartId에 저장하고 통과
 * 4. 복호화 실패 시 401 Unauthorized 에러
 */
@Injectable()
export class AiAgentAuthGuard implements CanActivate {
  private readonly logger = new Logger(AiAgentAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const encryptedToken = request.headers['x-token'];

    // 1. x-token 헤더 존재 확인
    if (!encryptedToken) {
      this.logger.warn('AI Agent 인증 실패: x-token 헤더 없음');
      throw new UnauthorizedException('x-token 헤더가 필요합니다.');
    }

    try {
      // 2. AES-GCM 복호화 시도
      const decryptedChartId = CryptoUtil.decrypt(encryptedToken);

      // 3. 복호화된 값이 유효한지 확인
      if (!decryptedChartId || decryptedChartId === encryptedToken) {
        // decrypt가 실패하면 원본을 반환하므로 비교로 실패 판단
        this.logger.warn('AI Agent 인증 실패: 복호화 실패 또는 빈 값');
        throw new UnauthorizedException('유효하지 않은 토큰입니다.');
      }

      // 4. req 객체에 chartId 저장
      request.chartId = decryptedChartId;

      this.logger.log(`AI Agent 인증 성공: chartId=${decryptedChartId}`);
      return true;

    } catch (error) {
      this.logger.error('AI Agent 인증 에러:', error);
      throw new UnauthorizedException('토큰 인증에 실패했습니다.');
    }
  }
}
