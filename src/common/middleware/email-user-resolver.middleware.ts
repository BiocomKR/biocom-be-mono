import { Injectable, NestMiddleware, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../services/prisma.service';

/**
 * [DEPRECATED] 이메일 기반 사용자 식별 미들웨어
 * 
 * 주의: 이 미들웨어는 아임웹 연동을 위해 만들어진 임시 방편입니다.
 * JWT 인증을 사용하는 것이 표준이며, 이 미들웨어는 사용하지 않는 것을 권장합니다.
 * 
 * 원래 작동 방식:
 * 1. 요청 헤더, 쿼리 파라미터, 또는 body에서 이메일 추출
 * 2. 데이터베이스에서 해당 이메일의 사용자 조회
 * 3. 사용자가 존재하지 않으면 400 에러 반환
 * 4. 사용자가 존재하면 userId를 request 객체에 추가
 */

// Request 객체 확장을 위한 타입 정의
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userEmail?: string;
      user?: User; // JWT 인증에서 사용할 user 객체
    }
  }
}

@Injectable()
export class EmailUserResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(EmailUserResolverMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 미들웨어 실행 함수 - 현재는 아무 동작도 하지 않고 통과시킴
   * JWT 인증을 사용하세요!
   */
  async use(req: Request, res: Response, next: NextFunction) {
    // 이 미들웨어는 비활성화되었습니다.
    // JWT 인증을 사용하세요.
    return next();
    
    /* 
    // ===== 아래는 아임웹 연동을 위한 레거시 코드입니다 =====
    // ===== 절대 사용하지 마세요! =====
    
    this.logger.debug(`이메일 기반 사용자 식별 미들웨어 실행 - ${req.method} ${req.path}`);

    // Swagger 문서 API와 헬스체크는 건너뛰기
    if (req.path.includes('/api/docs') || req.path.includes('/health')) {
      this.logger.debug('Swagger 문서 API 또는 헬스체크 감지 - 미들웨어 건너뛰기');
      return next();
    }

    try {
      // 이메일 추출 (우선순위: header > query > body)
      const email = this.extractEmailFromRequest(req);

      if (!email) {
        this.logger.warn('요청에서 사용자 이메일을 찾을 수 없음');
        throw new BadRequestException('사용자 이메일이 필요합니다. 헤더(x-user-email), 쿼리(email), 또는 body(email)에 포함해주세요.');
      }

      this.logger.debug(`추출된 이메일: ${email}`);

      // 데이터베이스에서 사용자 조회
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, nickname: true },
      });

      if (!user) {
        this.logger.warn(`존재하지 않는 사용자 이메일: ${email}`);
        throw new BadRequestException(`이메일 ${email}에 해당하는 사용자가 존재하지 않습니다. 먼저 사용자를 등록해주세요.`);
      }

      // Request 객체에 사용자 정보 추가
      req.userId = user.id;
      req.userEmail = user.email;

      this.logger.debug(`사용자 식별 완료 - ID: ${user.id}, 이메일: ${user.email}`);

      next();
    } catch (error) {
      this.logger.error('이메일 기반 사용자 식별 중 오류 발생', error);
      
      // BadRequestException이 아닌 경우 내부 서버 오류로 처리
      if (!(error instanceof BadRequestException)) {
        throw new BadRequestException('사용자 식별 중 오류가 발생했습니다.');
      }
      
      throw error;
    }
    */
  }

  /**
   * [DEPRECATED] 요청에서 이메일 추출
   */
  private extractEmailFromRequest(req: Request): string | null {
    // 이 메서드는 더 이상 사용되지 않습니다.
    return null;
    
    /*
    // 1. 헤더에서 이메일 추출
    const headerEmail = req.headers['x-user-email'] as string;
    if (headerEmail) {
      this.logger.debug('헤더에서 이메일 추출');
      return headerEmail.trim();
    }

    // 2. 쿼리 파라미터에서 이메일 추출
    const queryEmail = req.query.email as string;
    if (queryEmail) {
      this.logger.debug('쿼리 파라미터에서 이메일 추출');
      return queryEmail.trim();
    }

    // 3. body에서 이메일 추출 (POST/PUT/PATCH 요청)
    if (req.body && typeof req.body === 'object' && req.body.email) {
      this.logger.debug('body에서 이메일 추출');
      return req.body.email.trim();
    }

    return null;
    */
  }
}