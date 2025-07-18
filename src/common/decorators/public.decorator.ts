import { SetMetadata } from '@nestjs/common';

/**
 * Public 데코레이터
 * 이 데코레이터가 적용된 라우트는 JWT 인증을 건너뜀
 * 
 * 사용 예:
 * @Public()
 * @Get('public-resource')
 * getPublicResource() { ... }
 */
export const Public = () => SetMetadata('isPublic', true);