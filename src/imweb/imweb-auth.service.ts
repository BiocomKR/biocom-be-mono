import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { ImwebErrorCode, ImwebErrorResponse } from './dto/imweb-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 아임웹 인증 관리 서비스
 * - 토큰 발급/갱신
 * - 토큰 유효성 검증
 * - 동시성 제어
 */
@Injectable()
export class ImwebAuthService {
  private readonly logger = new Logger(ImwebAuthService.name);
  private readonly tokenRefreshMap = new Map<string, Promise<void>>();
  private readonly IMWEB_API_BASE = 'https://openapi.imweb.me';
  private readonly TOKEN_BUFFER_TIME = 5 * 60 * 1000; // 5분 여유

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 사이트 코드로 설정 정보 조회
   */
  async getImwebConfig(siteCode: string) {

    const config = await this.prisma.imwebInfo.findUnique({
      where: { siteCode },
    });

    if (!config) {
      throw new ImwebErrorResponse(
        ImwebErrorCode.CONFIG_NOT_FOUND,
        `사이트 코드 ${siteCode}에 대한 설정을 찾을 수 없습니다.`,
      );
    }

    return config;
  }

  /**
   * 유효한 액세스 토큰 반환
   * - 만료되었거나 만료 임박 시 자동 갱신
   */
  async getValidAccessToken(siteCode: string): Promise<string> {
    const config = await this.getImwebConfig(siteCode);

    // 토큰이 없으면 신규 토큰 취득
    if (!config.accessToken || !config.refreshToken) {
      this.logger.log(`토큰이 없습니다. 신규 토큰 취득 시작 siteCode: ${siteCode}`);
      await this.handleToken(siteCode);
      
      const updatedConfig = await this.getImwebConfig(siteCode);
      return updatedConfig.accessToken;
    }

    // 토큰 유효성 검사
    if (this.isTokenValid(config.accessToken)) {
      return config.accessToken;
    }

    // 토큰 만료 - 신규 토큰 취득 필요
    this.logger.log(`토큰 만료 감지, 신규 토큰 취득 시작 siteCode: ${siteCode}`);
    await this.handleToken(siteCode);
    
    const updatedConfig = await this.getImwebConfig(siteCode);
    return updatedConfig.accessToken;
  }

  /**
   * 토큰 유효성 검사
   */
  private isTokenValid(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return false;
      }

      const expiryTime = decoded.exp * 1000;
      const currentTime = Date.now();
      
      // 5분 여유를 두고 검사
      return expiryTime > currentTime + this.TOKEN_BUFFER_TIME;
    } catch (error) {
      this.logger.error(`토큰 디코드 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 토큰 처리 (만료 시 신규 토큰 취득)
   * - 아임웹은 토큰 갱신 개념이 없음. 무조건 신규 토큰 취득만 가능
   * - 동시성 제어: 동시에 여러 요청이 와도 한 번만 실행
   */
  private async handleToken(siteCode: string): Promise<void> {
    // 이미 토큰 취득 중이면 대기
    if (this.tokenRefreshMap.has(siteCode)) {
      this.logger.log(`토큰 취득 대기 중 siteCode: ${siteCode}`);
      await this.tokenRefreshMap.get(siteCode);
      return;
    }

    // 신규 토큰 취득 프로미스 생성
    const authPromise = this.getAuthorizationCodeAndToken()
      .then(() => {
        this.logger.log(`신규 토큰 취득 성공`);
      })
      .catch((error) => {
        this.logger.error(`신규 토큰 취득 실패 siteCode: ${siteCode}`, error);
        throw new ImwebErrorResponse(
          ImwebErrorCode.TOKEN_REFRESH_FAILED,
          '신규 토큰 취득에 실패했습니다. 아임웹 인증 서버에 문제가 있을 수 있습니다.',
          error.response?.data || error.message,
        );
      })
      .finally(() => {
        this.tokenRefreshMap.delete(siteCode);
      });

    this.tokenRefreshMap.set(siteCode, authPromise);
    await authPromise;
  }


  /**
   * 아임웹 인증 프로세스 (인가코드 발급 )
   * - 사이트코드는 일단 하드코딩
   */
  /**
   * 백엔드에서 인가코드 받아서 바로 토큰까지 발급
   * - 302 리다이렉트에서 code 추출
   * - 바로 토큰 교환까지 처리
   */
  async getAuthorizationCodeAndToken(): Promise<any> {
    const siteCode = 'S20190715619285c855898'; // 바이오컴 사이트코드. 일단 하드코딩
    
    // 1. imweb_info 테이블 조회
    const config = await this.getImwebConfig(siteCode);

    try {
      // 2. 인가코드 발급 API 호출 (GET)
      await firstValueFrom(
        this.httpService.get<any>(
          `${this.IMWEB_API_BASE}/oauth2/authorize`,
          {
            params: {
              responseType: 'code',
              clientId: config.clientId,
              redirectUri: config.redirectUri,
              scope: config.scope,
              siteCode: config.siteCode,
            },
            timeout: 10000,
            maxRedirects: 0, // 리다이렉트 막기
            validateStatus: (status) => false, // 모든 응답을 에러로 처리해서 catch로 가도록
          },
        ),
      );

      // 여기까지 오면 안 됨 (302로 리다이렉트되어야 정상)
      throw new Error('인가코드 발급 실패');

    } catch (error) {
      // 302 리다이렉트 응답 처리
      if (error.response?.status === 302) {
        const redirectUrl = error.response.headers.location;
        this.logger.log(`리다이렉트 URL: ${redirectUrl}`);
        
        // URL에서 code 파라미터 추출
        const url = new URL(redirectUrl);
        const code = url.searchParams.get('code');
        const errorCode = url.searchParams.get('errorCode');
        
        if (errorCode) {
          const message = url.searchParams.get('message');
          throw new ImwebErrorResponse(
            ImwebErrorCode.AUTH_FAILED,
            `아임웹 인증 실패: ${decodeURIComponent(message || '알 수 없는 오류')}`,
          );
        }
        
        if (!code) {
          throw new ImwebErrorResponse(
            ImwebErrorCode.AUTH_FAILED,
            '인가코드를 받지 못했습니다.',
          );
        }
        
        this.logger.log(`인가코드 획득: ${code}`);
        
        // 3. 바로 토큰 교환
        return await this.getAccessToken(code);
      }
      
      this.logger.error(`아임웹 인증 실패`, error);
      throw new ImwebErrorResponse(
        ImwebErrorCode.AUTH_FAILED,
        '아임웹 인증에 실패했습니다.',
        error.response?.data || error.message,
      );
    }
  }

  /**
   * Authorization Code를 Access Token으로 교환
   * OAuth 콜백에서 받은 code를 사용하여 토큰 발급
   */
  async exchangeCodeForToken(code: string): Promise<string> {
    const result = await this.getAccessToken(code);
    return result.accessToken;
  }

  /**
   * 아임웹 인증 프로세스 (인가코드 발급 → 토큰 발급 → DB 저장)
   * - 사이트코드는 일단 하드코딩
   */
  async getAccessToken(code: string): Promise<any> {
    const siteCode = 'S20190715619285c855898'; // 바이오컴 사이트코드. 일단 하드코딩
    
    // 1. imweb_info 테이블 조회
    const config = await this.getImwebConfig(siteCode);

    try {
      // 2. 토큰 발급 API 호출 (POST)
      const tokenResponse = await firstValueFrom(
        this.httpService.post(
          `${this.IMWEB_API_BASE}/oauth2/token`,
          new URLSearchParams({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            grantType: 'authorization_code',
            code: code,
            redirectUri: config.redirectUri,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
          },
        ),
      );

      const access_token = tokenResponse.data.data.accessToken;
      const refresh_token = tokenResponse.data.data.refreshToken;

      // 6. DB 업데이트
      await this.prisma.imwebInfo.update({
        where: { siteCode },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          updatedAt: getNowKST(),
        },
      });

      this.logger.log(`아임웹 인증 완료 siteCode: ${siteCode}`);
      return {
        accessToken: access_token,
        refreshToken: refresh_token,
      }
    } catch (error) {
      this.logger.error(`아임웹 인증 실패`, error);
      
      if (error instanceof ImwebErrorResponse) {
        throw error;
      }
      
      throw new ImwebErrorResponse(
        ImwebErrorCode.AUTH_FAILED,
        '아임웹 인증에 실패했습니다.',
        error.response?.data || error.message,
      );
    }
  }
}