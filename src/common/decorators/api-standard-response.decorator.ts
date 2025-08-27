import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import {
  StandardSuccessResponseDto,
  BadRequestResponseDto,
  UnauthorizedResponseDto,
  ForbiddenResponseDto,
  NotFoundResponseDto,
  ConflictResponseDto,
  InternalServerErrorResponseDto,
} from '../dto/standard-response.dto';

/**
 * 표준 API 응답 데코레이터
 * 모든 API에 공통적으로 적용되는 응답 형식을 정의
 */
export function ApiStandardResponse(options?: {
  successType?: any;
  successDescription?: string;
  includeNotFound?: boolean;
  includeConflict?: boolean;
  includeForbidden?: boolean;
}) {
  const decorators = [
    ApiResponse({
      status: 200,
      description: options?.successDescription || '요청이 성공적으로 처리되었습니다.',
      type: options?.successType || StandardSuccessResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: '잘못된 요청입니다.',
      type: BadRequestResponseDto,
    }),
    ApiResponse({
      status: 401,
      description: '인증이 필요합니다.',
      type: UnauthorizedResponseDto,
    }),
  ];

  if (options?.includeForbidden) {
    decorators.push(
      ApiResponse({
        status: 403,
        description: '권한이 없습니다.',
        type: ForbiddenResponseDto,
      })
    );
  }

  if (options?.includeNotFound) {
    decorators.push(
      ApiResponse({
        status: 404,
        description: '리소스를 찾을 수 없습니다.',
        type: NotFoundResponseDto,
      })
    );
  }

  if (options?.includeConflict) {
    decorators.push(
      ApiResponse({
        status: 409,
        description: '중복된 데이터입니다.',
        type: ConflictResponseDto,
      })
    );
  }

  decorators.push(
    ApiResponse({
      status: 500,
      description: '서버 오류가 발생했습니다.',
      type: InternalServerErrorResponseDto,
    })
  );

  return applyDecorators(...decorators);
}

/**
 * 생성 API 응답 데코레이터 (201)
 */
export function ApiCreatedResponse(options?: {
  type?: any;
  description?: string;
}) {
  return applyDecorators(
    ApiResponse({
      status: 201,
      description: options?.description || '리소스가 생성되었습니다.',
      type: options?.type || StandardSuccessResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: '잘못된 요청입니다.',
      type: BadRequestResponseDto,
    }),
    ApiResponse({
      status: 401,
      description: '인증이 필요합니다.',
      type: UnauthorizedResponseDto,
    }),
    ApiResponse({
      status: 409,
      description: '중복된 데이터입니다.',
      type: ConflictResponseDto,
    }),
    ApiResponse({
      status: 500,
      description: '서버 오류가 발생했습니다.',
      type: InternalServerErrorResponseDto,
    })
  );
}

/**
 * 관리자 API 응답 데코레이터
 */
export function ApiManagementResponse(options?: {
  successType?: any;
  successDescription?: string;
  includeNotFound?: boolean;
}) {
  const decorators = [
    ApiResponse({
      status: 200,
      description: options?.successDescription || '요청이 성공적으로 처리되었습니다.',
      type: options?.successType || StandardSuccessResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: '잘못된 요청입니다.',
      type: BadRequestResponseDto,
    }),
    ApiResponse({
      status: 401,
      description: 'API 키가 유효하지 않습니다.',
      type: UnauthorizedResponseDto,
    }),
    ApiResponse({
      status: 403,
      description: '권한이 없습니다.',
      type: ForbiddenResponseDto,
    }),
  ];

  if (options?.includeNotFound) {
    decorators.push(
      ApiResponse({
        status: 404,
        description: '리소스를 찾을 수 없습니다.',
        type: NotFoundResponseDto,
      })
    );
  }

  decorators.push(
    ApiResponse({
      status: 500,
      description: '서버 오류가 발생했습니다.',
      type: InternalServerErrorResponseDto,
    })
  );

  return applyDecorators(...decorators);
}