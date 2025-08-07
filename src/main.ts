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
  
  // Winston Logger 사용
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

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
      },
      'access-token',
    )
    .addTag('health', '서버 상태 확인')
    .addTag('auth', '인증')
    .addTag('upload', '파일 업로드')
    .addTag('users', '사용자 관리')
    .addTag('event', '이벤트')
    .addTag('mission', '미션')
    .addTag('survey', '설문')
    .addTag('management-api-key', '관리자 API 키')
    .addTag('management-event', '관리자 이벤트')
    .addTag('management-users', '관리자 사용자')
    .addTag('management-mission', '관리자 미션')
    .addTag('management-survey', '관리자 설문')
    .addTag('management-quiz', '관리자 퀴즈')
    .addTag('management-content', '관리자 컨텐츠')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // 인증 정보 유지
      tagsSorter: 'alpha', // 태그 알파벳 순서로 정렬
      operationsSorter: 'alpha', // 오퍼레이션 알파벳 순서로 정렬
    },
  });
  // 서버 포트 설정
  const port = configService.app.port;
  
  logger.log(`Swagger API 문서화 설정 완료: http://localhost:${port}/api/docs`);
  
  // 애플리케이션 시작
  await app.listen(port);
  
  logger.log(`🚀 애플리케이션이 포트 ${port}에서 시작되었습니다.`);
  logger.log(`📚 API 문서: http://localhost:${port}/api/docs`);
  logger.log(`🌐 API 베이스 URL: http://localhost:${port}/api`);
  logger.log(`🌍 환경: ${configService.app.env}`);
}

// 부트스트랩 실행 및 에러 처리
bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('애플리케이션 시작 중 오류가 발생했습니다:', error);
  process.exit(1);
});