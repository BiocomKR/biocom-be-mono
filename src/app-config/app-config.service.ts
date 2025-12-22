import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CryptoUtil } from '../common/utils/crypto.util';

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 설정 단건 조회 (키로 조회)
   * 암호화된 값은 자동 복호화
   */
  async getConfigByKey(configKey: string): Promise<{
    configKey: string;
    configValue: string | null;
    valueType: string;
  } | null> {
    const config = await this.prisma.appConfig.findUnique({
      where: { configKey, isActive: true },
      select: {
        configKey: true,
        configValue: true,
        valueType: true,
        isEncrypted: true,
      },
    });

    if (!config) {
      return null;
    }

    // 암호화된 값은 복호화
    const configValue = config.isEncrypted && config.configValue
      ? CryptoUtil.decrypt(config.configValue)
      : config.configValue;

    return {
      configKey: config.configKey,
      configValue,
      valueType: config.valueType,
    };
  }

  /**
   * 설정 다건 조회 (키 배열로 조회)
   * 암호화된 값은 자동 복호화
   */
  async getConfigsByKeys(configKeys: string[]): Promise<Record<string, string | null>> {
    const configs = await this.prisma.appConfig.findMany({
      where: {
        configKey: { in: configKeys },
        isActive: true,
      },
      select: {
        configKey: true,
        configValue: true,
        isEncrypted: true,
      },
    });

    const result: Record<string, string | null> = {};

    for (const config of configs) {
      // 암호화된 값은 복호화
      result[config.configKey] = config.isEncrypted && config.configValue
        ? CryptoUtil.decrypt(config.configValue)
        : config.configValue;
    }

    // 없는 키는 null로 채움
    for (const key of configKeys) {
      if (!(key in result)) {
        result[key] = null;
      }
    }

    return result;
  }

  /**
   * 설정 값 조회 (값만 반환)
   * 없으면 기본값 반환
   */
  async getValue(configKey: string, defaultValue: string | null = null): Promise<string | null> {
    const config = await this.getConfigByKey(configKey);
    return config?.configValue ?? defaultValue;
  }

  /**
   * 숫자형 설정 값 조회
   */
  async getNumberValue(configKey: string, defaultValue: number | null = null): Promise<number | null> {
    const value = await this.getValue(configKey);
    if (value === null) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * JSON 설정 값 조회
   */
  async getJsonValue<T>(configKey: string, defaultValue: T | null = null): Promise<T | null> {
    const value = await this.getValue(configKey);
    if (value === null) return defaultValue;
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Boolean 설정 값 조회
   */
  async getBooleanValue(configKey: string, defaultValue: boolean = false): Promise<boolean> {
    const value = await this.getValue(configKey);
    if (value === null) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }
}
