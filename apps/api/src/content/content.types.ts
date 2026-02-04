/**
 * 컨텐츠 타입 enum
 */
export enum ContentType {
  ARTICLE = 'ARTICLE',           // 일반 아티클
  EDUCATION = 'EDUCATION',       // 교육 자료
  TIP = 'TIP',                   // 건강 팁
  ANNOUNCEMENT = 'ANNOUNCEMENT', // 공지사항
  GUIDE = 'GUIDE'               // 가이드
}

/**
 * 첨부파일 MIME 타입
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

/**
 * 최대 파일 크기 (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 컨텐츠 생성 DTO
 */
export interface CreateContentDto {
  title: string;
  content: string;
  type?: ContentType;
  isActive?: boolean;
}

/**
 * 컨텐츠 수정 DTO
 */
export interface UpdateContentDto {
  title?: string;
  content?: string;
  type?: ContentType;
  isActive?: boolean;
}

/**
 * 컨텐츠 파일 DTO
 */
export interface ContentFileDto {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sortOrder?: number;
}