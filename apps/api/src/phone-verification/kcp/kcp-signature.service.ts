import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { SignatureData } from './kcp.types';

/**
 * NHN KCP 서명 생성 서비스
 * SHA256WithRSA + Base64 인코딩으로 서명 데이터 생성
 */
@Injectable()
export class KcpSignatureService {
  private readonly logger = new Logger(KcpSignatureService.name);
  private privateKey: string;

  constructor(private readonly configService: ConfigService) {
    this.loadPrivateKey();
  }

  /**
   * 개인키 로드
   */
  private loadPrivateKey(): void {
    const privateKeyPath = this.configService.get<string>(
      'KCP_PRIVATE_KEY_PATH',
    );
    const privateKeyPassword = this.configService.get<string>(
      'KCP_PRIVATE_KEY_PASSWORD',
    );

    if (!privateKeyPath) {
      throw new Error(
        'KCP 개인키 경로가 설정되지 않았습니다.',
      );
    }

    try {
      // PKCS#8 포맷 개인키 읽기
      const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');

      // 개인키 복호화 (비밀번호가 있으면 사용, 없으면 생략)
      const keyOptions: any = {
        key: privateKeyPem,
        format: 'pem',
      };

      if (privateKeyPassword) {
        keyOptions.passphrase = privateKeyPassword;
      }

      this.privateKey = crypto
        .createPrivateKey(keyOptions)
        .export({ type: 'pkcs8', format: 'pem' }) as string;

      this.logger.log('KCP 개인키 로드 완료');
    } catch (error) {
      this.logger.error('KCP 개인키 로드 실패:', error);
      throw new Error('KCP 개인키를 로드할 수 없습니다.');
    }
  }

  /**
   * 실명 확인용 서명 생성
   * 조합: phone_no^birth_day^user_name^local_code^sex_code
   */
  generateIdentitySignature(data: SignatureData): string {
    const targetData = `${data.phone_no}^${data.birth_day}^${data.user_name}^${data.local_code}^${data.sex_code}`;

    this.logger.log('='.repeat(80));
    this.logger.log('🔐 서명 데이터 생성');
    this.logger.log(`📞 phone_no: ${data.phone_no}`);
    this.logger.log(`🎂 birth_day: ${data.birth_day}`);
    this.logger.log(`👤 user_name: ${data.user_name}`);
    this.logger.log(`🌍 local_code: ${data.local_code}`);
    this.logger.log(`🚻 sex_code: ${data.sex_code}`);
    this.logger.log(`📝 조합된 데이터: ${targetData}`);
    this.logger.log('='.repeat(80));

    const signature = this.sign(targetData);

    this.logger.log(`✅ 서명 생성 완료: ${signature.substring(0, 50)}...`);

    return signature;
  }

  /**
   * 간편인증용 서명 생성 (미사용 - SMS만 구현)
   * 조합: phone_no^user_name
   */
  generateSimpleSignature(phone_no: string, user_name: string): string {
    const targetData = `${phone_no}^${user_name}`;
    return this.sign(targetData);
  }

  /**
   * SHA256WithRSA 서명 + Base64 인코딩
   */
  private sign(data: string): string {
    try {
      const sign = crypto.createSign('SHA256');
      sign.update(data, 'utf8');
      sign.end();

      const signature = sign.sign(this.privateKey, 'base64');

      this.logger.debug(`서명 생성 완료: ${data.substring(0, 20)}...`);
      return signature;
    } catch (error) {
      this.logger.error('서명 생성 실패:', error);
      throw new Error('서명 생성 중 오류가 발생했습니다.');
    }
  }
}
