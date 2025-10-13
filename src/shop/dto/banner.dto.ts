import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 배너 응답 DTO
 */
export class BannerDto {
  @ApiProperty({ description: '배너 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '배너 타입 (SHOP: 쇼핑몰, HOME: 메인홈, EVENT: 이벤트)',
    example: 'SHOP',
    enum: ['SHOP', 'HOME', 'EVENT']
  })
  bannerType: string;

  @ApiProperty({ description: '배너 제목', example: '신규가입 특별 할인' })
  title: string;

  @ApiProperty({
    description: '배너 이미지 URL',
    example: 'https://storage.googleapis.com/biocom/banners/welcome.jpg'
  })
  imageUrl: string;

  @ApiPropertyOptional({
    description: '클릭시 이동할 URL',
    example: '/shop/category/best'
  })
  linkUrl?: string;

  @ApiProperty({
    description: '링크 타입 (INTERNAL: 앱 내부, EXTERNAL: 외부, PRODUCT: 상품)',
    example: 'INTERNAL',
    enum: ['INTERNAL', 'EXTERNAL', 'PRODUCT']
  })
  linkType: string;

  @ApiPropertyOptional({ description: '배너 설명', example: '첫 구매 30% 할인' })
  description?: string;
}
