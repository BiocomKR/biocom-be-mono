# 멀티 스테이지 빌드를 사용하여 이미지 크기 최적화

# Build stage - 빌드 전용 스테이지
FROM node:20-alpine AS builder

# 빌드 인수
# 빌드 환경 (기본값: production)
ARG NODE_ENV=production
# 환경 변수로 설정
ENV NODE_ENV=${NODE_ENV}

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사 (의존성 캐싱 최적화)
# package.json, package-lock.json 복사
COPY package*.json ./
# Prisma 스키마 복사
COPY prisma ./prisma/

# 의존성 설치 (개발 의존성 포함)
# 모든 의존성 설치 (빌드에 필요)
RUN npm ci --legacy-peer-deps --include=dev

# 소스 코드 복사
COPY . .

# Prisma 클라이언트 생성
# TypeScript 타입 생성
RUN npx prisma generate

# 애플리케이션 빌드
# TypeScript → JavaScript 컴파일
RUN npx nest build

# 운영용 의존성만 설치
# devDependencies 제거
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Production stage - 실제 운영 환경용 최종 이미지
FROM node:20-alpine AS production

# 보안을 위한 non-root 사용자 생성 (권한 최소화 원칙)
# nodejs 그룹 생성 (GID: 1001)
RUN addgroup -g 1001 -S nodejs
# nestjs 사용자 생성 (UID: 1001)
RUN adduser -S nestjs -u 1001

# 작업 디렉토리 설정
WORKDIR /app

# 운영에 필요한 파일들만 복사 (빌드 스테이지에서 가져옴)
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# 로그 디렉토리 생성 (컨테이너 내부)
RUN mkdir -p /var/log/nestjs-app && chown nestjs:nodejs /var/log/nestjs-app

# 업로드 디렉토리 생성
RUN mkdir -p /var/app/uploads && chown nestjs:nodejs /var/app/uploads

# 포트 노출 (NestJS 기본 포트)
EXPOSE 3000

# non-root 사용자로 전환 (보안 강화)
# 이후 모든 명령은 nestjs 사용자 권한으로 실행
USER nestjs

# 헬스체크 설정 (HTTP endpoint 사용)
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); })"

# 애플리케이션 시작 (운영 모드)
# 컴파일된 메인 파일 실행
CMD ["node", "dist/src/main.js"]