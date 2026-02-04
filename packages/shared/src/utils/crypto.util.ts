import * as crypto from 'crypto';

/**
 * AES-256-GCM 암호화/복호화 유틸리티
 * 개인정보(이름, 휴대폰번호) 암호화용
 */
export class CryptoUtil {
  private static algorithm = 'aes-256-gcm';
  private static keyLength = 32; // 256 bits
  private static ivLength = 16; // 128 bits
  private static tagLength = 16; // 128 bits
  
  /**
   * 암호화 키 가져오기
   * 환경변수에서 읽어오고, 없으면 기본값 사용
   */
  private static getKey(): Buffer {
    // 정확히 32바이트 키 (형님이 나중에 수정하실 부분)
    const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-32bytes!';

    // 키가 32바이트가 아니면 해시로 변환
    if (key.length !== 32) {
      return crypto.createHash('sha256').update(key).digest();
    }

    return Buffer.from(key);
  }

  /**
   * 문자열 암호화
   * @param text 암호화할 평문
   * @returns 암호화된 문자열 (base64 인코딩)
   */
  static encrypt(text: string): string {
    if (!text) return text;

    try {
      const key = this.getKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
      ]);
      
      const tag = (cipher as any).getAuthTag();
      
      // IV + 인증태그 + 암호문 순서로 결합
      const combined = Buffer.concat([iv, tag, encrypted]);
      
      return combined.toString('base64');
    } catch (error) {
      console.error('암호화 실패:', error);
      throw new Error('암호화 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 문자열 복호화
   * @param encryptedText 암호화된 문자열 (base64)
   * @returns 복호화된 평문
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;

    try {
      const key = this.getKey();
      const combined = Buffer.from(encryptedText, 'base64');

      // IV, 인증태그, 암호문 분리
      const iv = combined.slice(0, this.ivLength);
      const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      (decipher as any).setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.error('복호화 실패:', error);
      // 복호화 실패 시 원본 반환 (마이그레이션 고려)
      return encryptedText;
    }
  }

  /**
   * 결정론적 암호화 (휴대폰 번호 전용)
   * 고정 IV로 같은 평문 = 같은 암호문 생성
   * WHERE 절 검색을 위해 사용 (GCM 대신 CBC 사용)
   *
   * @param text 암호화할 평문
   * @returns 암호화된 문자열 (base64 인코딩)
   */
  static encryptDeterministic(text: string): string {
    if (!text) return text;

    try {
      const key = this.getKey();
      // 고정된 IV 사용 (항상 동일한 값)
      const iv = crypto.createHash('md5').update('biocom-mobile-fixed-iv-2025').digest();
      // CBC 모드 사용 (deterministic 암호화에 적합)
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
      ]);

      return encrypted.toString('base64');
    } catch (error) {
      console.error('결정론적 암호화 실패:', error);
      throw new Error('암호화 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 결정론적 암호화 복호화 (휴대폰 번호 전용)
   *
   * @param encryptedText 암호화된 문자열 (base64)
   * @returns 복호화된 평문
   */
  static decryptDeterministic(encryptedText: string): string {
    if (!encryptedText) return encryptedText;

    try {
      const key = this.getKey();
      const encrypted = Buffer.from(encryptedText, 'base64');

      // 고정된 IV 사용 (암호화와 동일)
      const iv = crypto.createHash('md5').update('biocom-mobile-fixed-iv-2025').digest();

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.error('결정론적 복호화 실패:', error);
      // 복호화 실패 시 원본 반환
      return encryptedText;
    }
  }
}