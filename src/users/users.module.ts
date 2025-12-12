import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MypageController } from './mypage.controller';
import { MypageService } from './mypage.service';
import { ImwebModule } from '../imweb/imweb.module';

/**
 * 사용자 모듈
 * V2 방식의 단일 컨트롤러 및 서비스 포함
 *
 * 기능:
 * - 사용자 CRUD (생성, 조회, 수정, 삭제)
 * - offset/limit 기반 페이지네이션
 * - 검색 및 정렬 기능
 * - 관련 리소스 포함 옵션
 * - JWT 인증 보호
 * - 아임웹 회원 검색 기능
 * - 마이페이지 (주소 관리, 환불계좌, 프로필 이미지)
 */
@Module({
  imports: [ImwebModule], // ImwebApiService 사용을 위해 추가
  controllers: [UsersController, MypageController],
  providers: [UsersService, MypageService],
  exports: [UsersService, MypageService], // 다른 모듈에서 사용할 수 있도록 export
})
export class UsersModule {}