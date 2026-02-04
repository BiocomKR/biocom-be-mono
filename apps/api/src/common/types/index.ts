/**
 * 공통 타입 정의 파일
 * 애플리케이션 전반에서 사용되는 타입들을 정의
 */

/**
 * 페이지네이션 요청 옵션
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 페이지네이션 응답 메타데이터
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * API 응답 형식
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code?: string;
    details?: any;
  };
  timestamp: Date;
}

/**
 * 파일 업로드 응답 타입
 */
export interface FileUploadResponse {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
}