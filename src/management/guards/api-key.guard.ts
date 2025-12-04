// import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
// import { Observable } from 'rxjs';
// import { PrismaService } from '../../common/services/prisma.service';
// 
// /**
//  * API Key 인증 가드
//  * 백오피스에서 사용하는 API 접근을 위한 인증
//  * 헤더: X-API-KEY
//  */
// @Injectable()
// export class ApiKeyGuard implements CanActivate {
//   private readonly logger = new Logger(ApiKeyGuard.name);
// 
//   constructor(private readonly prisma: PrismaService) {}
// 
//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest();
//     const apiKey = request.headers['x-api-key'];
// 
//     this.logger.log(`API Key 인증 시도 - Path: ${request.path}`);
// 
//     if (!apiKey) {
//       this.logger.warn('API Key가 제공되지 않았습니다.');
//       throw new UnauthorizedException('API Key가 필요합니다.');
//     }
// 
//     try {
//       // API Key 검증
//       const validApiKey = await this.prisma.apiKey.findFirst({
//         where: {
//           key: apiKey,
//           isActive: true,
//         },
//       });
// 
//       if (!validApiKey) {
//         this.logger.warn(`유효하지 않은 API Key: ${apiKey.substring(0, 8)}...`);
//         throw new UnauthorizedException('유효하지 않은 API Key입니다.');
//       }
// 
//       // 마지막 사용 시간 업데이트 (비동기로 처리하여 응답 지연 방지)
//       // Prisma의 $executeRaw를 사용하여 직접 쿼리 실행
//       this.prisma.$executeRaw`
//         UPDATE api_keys 
//         SET last_used_at = NOW(), updated_at = NOW() 
//         WHERE id = ${validApiKey.id}
//       `.catch(err => {
//         this.logger.error('API Key 사용 시간 업데이트 실패:', err);
//       });
// 
//       // request에 API Key 정보 추가
//       request.apiKey = validApiKey;
// 
//       this.logger.log(`API Key 인증 성공 - Name: ${validApiKey.name}`);
//       return true;
//     } catch (error) {
//       if (error instanceof UnauthorizedException) {
//         throw error;
//       }
//       this.logger.error('API Key 검증 중 오류 발생:', error);
//       throw new UnauthorizedException('API Key 검증에 실패했습니다.');
//     }
//   }
// }
