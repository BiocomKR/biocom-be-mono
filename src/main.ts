import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';
import { ConfigService } from './common/services/config.service';
import { LoggerService } from './common/services/logger.service';
import { createCorsOptions } from './common/config/cors.config';
import { RequestIdInterceptor, ResponseTransformInterceptor, TimeoutInterceptor } from './common/interceptors';

/**
 * 애플리케이션 부트스트랩 함수
 * NestJS 애플리케이션을 초기화하고 설정하는 메인 함수
 * 
 * 주요 설정:
 * - 글로벌 Validation Pipe 설정
 * - Swagger API 문서화 설정
 * - CORS 활성화
 * - 포트 설정 및 서버 시작
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log('애플리케이션 초기화를 시작합니다...');

  // NestJS 애플리케이션 인스턴스 생성
  const app = await NestFactory.create(AppModule);

  // 환경별 로거 설정
  // 개발 환경: NestJS 기본 Logger (콘솔 로그 잘 보임)
  // 운영 환경: Winston Logger (파일 저장)
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // 운영 환경: Winston Logger 사용 (파일 저장)
    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
    logger.log('Winston Logger 활성화 (운영 환경)');
  } else {
    // 개발 환경: NestJS 기본 Logger 사용 (콘솔 출력)
    logger.log('NestJS 기본 Logger 활성화 (개발 환경)');
  }

  // 글로벌 API 접두사 설정
  app.setGlobalPrefix('api');
  logger.log('글로벌 API 접두사 설정 완료: /api');


  // 글로벌 Exception Filter 설정
  // 모든 예외를 일관된 형식으로 처리
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  logger.log('글로벌 Exception Filter 설정 완료');

  // 글로벌 Validation Pipe 설정
  // 모든 DTO 유효성 검사를 자동으로 처리
  app.useGlobalPipes(
    new ValidationPipe({
      // 요청 DTO에 정의되지 않은 속성 제거
      whitelist: true,
      // 정의되지 않은 속성이 있을 때 요청 거부
      forbidNonWhitelisted: true,
      // 문자열을 적절한 타입으로 자동 변환
      transform: true,
      // 상세한 에러 메시지 제공
      disableErrorMessages: false,
      // 에러 발생 시 모든 에러 반환
      stopAtFirstError: false,
      // HTTP 예외로 변환
      exceptionFactory: (errors) => {
        const messages = errors.map(error => {
          const constraints = Object.values(error.constraints || {});
          return `${error.property}: ${constraints.join(', ')}`;
        });
        return new ValidationPipe().createExceptionFactory()(errors);
      },
    }),
  );
  logger.log('글로벌 Validation Pipe 설정 완료');

  // ConfigService와 LoggerService 가져오기
  const configService = app.get(ConfigService);
  const loggerService = app.get(LoggerService);

  // 글로벌 인터셉터 설정
  // 순서 중요: RequestId -> Timeout -> Transform 순으로 실행
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new TimeoutInterceptor(configService),
    new ResponseTransformInterceptor(),
  );
  logger.log('글로벌 인터셉터 설정 완료');
  
  // CORS(Cross-Origin Resource Sharing) 활성화
  // 다른 도메인에서의 API 접근 허용
  const corsOptions = createCorsOptions(configService, loggerService);
  app.enableCors(corsOptions);
  logger.log(`CORS 설정 완료 - Origin: ${configService.cors.origin}, Credentials: ${configService.cors.credentials}`);

  // Swagger API 문서화 설정
  const config = new DocumentBuilder()
    .setTitle('Biocom API')
    .setDescription('바이오컴 백엔드 API 문서')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'JWT 토큰을 입력하세요',
        in: 'header',
      }
    )
    .addTag('시스템-상태확인', '서버 상태 확인')
    .addTag('시스템-인증', '인증 관리')
    .addTag('헬스케어-이미지 분석', '이미지 분석 및 업로드')
    .addTag('헬스케어-사용자', '사용자 관리')
    .addTag('헬스케어-포인트', '포인트 관리')
    .addTag('헬스케어-기록', '6가지 기록 관리 및 통계')
    .addTag('챌린지-관리', '챌린지 구매 및 활성화')
    .addTag('챌린지-미션', '미션 수행')
    .addTag('챌린지-설문', '설문조사')
    .addTag('챌린지-컨텐츠', '교육 컨텐츠')
    .addTag('챌린지-퀴즈', '퀴즈 완료')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // management 경로 제거
  Object.keys(document.paths).forEach(path => {
    if (path.includes('/management/')) {
      delete document.paths[path];
    }
  });
  
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // 인증 정보 유지
      tagsSorter: 'alpha', // 태그 알파벳 순서로 정렬
      operationsSorter: 'alpha', // 오퍼레이션 알파벳 순서로 정렬
      docExpansion: 'none', // 모든 태그를 접힌 상태로 시작 ('none' | 'list' | 'full')
      defaultModelsExpandDepth: -1, // 모델 스키마도 접힌 상태로
      defaultModelExpandDepth: 0, // 개별 모델도 접힌 상태로
    },
    customCss: `
      /* 기본 태그 스타일 (밝은 회색) */
      .opblock-tag {
        background: #f8f9fa !important;
        color: #495057 !important;
        border: 1px solid #dee2e6 !important;
        font-weight: 500 !important;
      }
      
      /* 태그 hover 효과 */
      .opblock-tag:hover {
        background: #e9ecef !important;
        color: #343a40 !important;
      }
    `,
  });
  // 서버 포트 설정
  const port = configService.app.port;
  
  logger.log(`Swagger API 문서화 설정 완료: http://localhost:${port}/api/docs`);
  
  // 애플리케이션 시작 - 모든 네트워크 인터페이스에서 수신
  logger.log(`포트 ${port}에서 서버 시작을 시도합니다...`);
  
  try {
    await app.listen(port, '0.0.0.0');
    logger.log(`✅ 서버가 성공적으로 포트 ${port}에서 시작되었습니다!`);
  } catch (error) {
    logger.error(`❌ 서버 시작 실패:`, error);
    throw error;
  }
  
  logger.log(`🚀 애플리케이션이 포트 ${port}에서 시작되었습니다.`);
  logger.log(`📚 API 문서: http://0.0.0.0:${port}/api/docs`);
  logger.log(`🌐 API 베이스 URL: http://0.0.0.0:${port}/api`);
  logger.log(`🌍 환경: ${configService.app.env}`);
  
  // 프로세스 종료 신호 처리
  process.on('SIGTERM', () => {
    logger.log('SIGTERM 신호를 받았습니다. 서버를 종료합니다...');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    logger.log('SIGINT 신호를 받았습니다. 서버를 종료합니다...');
    process.exit(0);
  });
}

// 부트스트랩 실행 및 에러 처리
bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('애플리케이션 시작 중 오류가 발생했습니다:', error);
  process.exit(1);
});