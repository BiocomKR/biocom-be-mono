import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 비즈니스 로직 예외
 * 비즈니스 규칙 위반 시 발생하는 예외
 * 
 * 사용 예:
 * throw new BusinessException('잔액이 부족합니다.', 'INSUFFICIENT_BALANCE');
 */
export class BusinessException extends HttpException {
  constructor(
    message: string,
    errorCode?: string,
    statusCode: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super(
      {
        success: false,
        message,
        error: 'Business Logic Error',
        errorCode,
        statusCode,
      },
      statusCode,
    );
  }
}

/**
 * 리소스를 찾을 수 없을 때 발생하는 예외
 * 
 * 사용 예:
 * throw new ResourceNotFoundException('사용자');
 */
export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, id?: string | number) {
    const message = id 
      ? `${resource}(ID: ${id})를 찾을 수 없습니다.`
      : `${resource}를 찾을 수 없습니다.`;
    
    super(
      {
        success: false,
        message,
        error: 'Resource Not Found',
        resource,
        id,
        statusCode: HttpStatus.NOT_FOUND,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * 중복된 리소스 예외
 * 
 * 사용 예:
 * throw new DuplicateResourceException('이메일', 'user@example.com');
 */
export class DuplicateResourceException extends HttpException {
  constructor(field: string, value: any) {
    super(
      {
        success: false,
        message: `이미 존재하는 ${field}입니다: ${value}`,
        error: 'Duplicate Resource',
        field,
        value,
        statusCode: HttpStatus.CONFLICT,
      },
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * 권한 부족 예외
 * 
 * 사용 예:
 * throw new InsufficientPermissionException('게시글 수정');
 */
export class InsufficientPermissionException extends HttpException {
  constructor(action: string) {
    super(
      {
        success: false,
        message: `${action} 권한이 없습니다.`,
        error: 'Insufficient Permission',
        action,
        statusCode: HttpStatus.FORBIDDEN,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}