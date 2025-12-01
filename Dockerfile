# 멀티 스테이지 빌드를 사용하여 이미지 크기 최적화
# biocom-bo-api용 Dockerfile

# Build stage - 빌드 전용 스테이지
FROM node:20-alpine AS builder

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

# 패키지 파일 복사 (의존성 캐싱 최적화)
COPY package*.json ./
COPY prisma ./prisma/

# 의존성 설치 (개발 의존성 포함)
RUN npm ci --legacy-peer-deps --include=dev

# 소스 코드 복사
COPY . .

# Prisma 클라이언트 생성
RUN npx prisma generate

# 애플리케이션 빌드
RUN npx nest build

# 운영용 의존성만 설치
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Production stage - 실제 운영 환경용 최종 이미지
FROM node:20-alpine AS production

# 보안을 위한 non-root 사용자 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app

# 운영에 필요한 파일들만 복사
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# 로그 디렉토리 생성
RUN mkdir -p /var/log/nestjs-app && chown nestjs:nodejs /var/log/nestjs-app

# 포트 노출 (biocom-bo-api 포트: 10805)
EXPOSE 10805

# non-root 사용자로 전환
USER nestjs

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10805/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); })"

# 애플리케이션 시작
CMD ["node", "dist/src/main.js"]
