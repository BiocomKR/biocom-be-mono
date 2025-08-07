/**
 * 특별 컨텐츠 아이템 타입 정의
 */
export interface SpecialContentItem {
  contentId: string;
  contentType: string;
  contentName: string;
  contentUrl?: string;
  description?: string;
  imageUrl?: string;
  [key: string]: any;
}