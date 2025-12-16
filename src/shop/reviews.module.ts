import { Module } from '@nestjs/common';
import { ReviewsController } from './controllers/reviews.controller';
import { ReviewsService } from './services/reviews.service';

/**
 * 상품 리뷰 모듈
 * 상품에 대한 고객 리뷰 작성, 조회, 수정, 삭제 기능 제공
 */
@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}