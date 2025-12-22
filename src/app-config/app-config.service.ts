import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CryptoUtil } from '../common/utils/crypto.util';
import { getNowKST } from '../common/utils/kst-date.util';
import { Prisma } from '@prisma/client';

export interface CreateAppConfigDto {
  configKey: string;
  configValue?: string;
  valueType?: string;
  isEncrypted?: boolean;
  description?: string;
  isActive?: boolean;
}

export interface UpdateAppConfigDto {
  configValue?: string;
  valueType?: string;
  isEncrypted?: boolean;
  description?: string;
  isActive?: boolean;
}

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 설정 목록 조회
   */
  async getConfigs(params: {
    search?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  }) {
    const { search, isActive, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.AppConfigWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { configKey: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [configs, total] = await Promise.all([
      this.prisma.appConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { configKey: 'asc' },
      }),
      this.prisma.appConfig.count({ where }),
    ]);

    // 암호화된 값은 마스킹 처리
    const maskedConfigs = configs.map((config) => ({
      ...config,
      configValue: config.isEncrypted ? '********' : config.configValue,
    }));

    return {
      items: maskedConfigs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 설정 단건 조회
   */
  async getConfigByKey(configKey: string, decrypt = false) {
    const config = await this.prisma.appConfig.findUnique({
      where: { configKey },
    });

    if (!config) {
      throw new NotFoundException(`설정을 찾을 수 없습니다: ${configKey}`);
    }

    // 암호화된 값 처리
    if (config.isEncrypted) {
      if (decrypt) {
        return {
          ...config,
          configValue: config.configValue ? CryptoUtil.decrypt(config.configValue) : null,
        };
      }
      return {
        ...config,
        configValue: '********',
      };
    }

    return config;
  }

  /**
   * 설정 생성
   */
  async createConfig(dto: CreateAppConfigDto) {
    // 중복 체크
    const existing = await this.prisma.appConfig.findUnique({
      where: { configKey: dto.configKey },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 설정 키입니다: ${dto.configKey}`);
    }

    // 암호화 처리
    let configValue = dto.configValue;
    if (dto.isEncrypted && configValue) {
      configValue = CryptoUtil.encrypt(configValue);
    }

    const config = await this.prisma.appConfig.create({
      data: {
        configKey: dto.configKey,
        configValue,
        valueType: dto.valueType || 'STRING',
        isEncrypted: dto.isEncrypted || false,
        description: dto.description,
        isActive: dto.isActive ?? true,
        createdAt: getNowKST(),
      },
    });

    this.logger.log(`설정 생성: ${config.configKey}`);

    return {
      ...config,
      configValue: config.isEncrypted ? '********' : config.configValue,
    };
  }

  /**
   * 설정 수정
   */
  async updateConfig(configKey: string, dto: UpdateAppConfigDto) {
    const existing = await this.prisma.appConfig.findUnique({
      where: { configKey },
    });

    if (!existing) {
      throw new NotFoundException(`설정을 찾을 수 없습니다: ${configKey}`);
    }

    // 암호화 처리
    let configValue = dto.configValue;
    const isEncrypted = dto.isEncrypted ?? existing.isEncrypted;
    if (isEncrypted && configValue) {
      configValue = CryptoUtil.encrypt(configValue);
    }

    const config = await this.prisma.appConfig.update({
      where: { configKey },
      data: {
        ...(configValue !== undefined && { configValue }),
        ...(dto.valueType !== undefined && { valueType: dto.valueType }),
        ...(dto.isEncrypted !== undefined && { isEncrypted: dto.isEncrypted }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`설정 수정: ${configKey}`);

    return {
      ...config,
      configValue: config.isEncrypted ? '********' : config.configValue,
    };
  }

  /**
   * 설정 삭제
   */
  async deleteConfig(configKey: string) {
    const existing = await this.prisma.appConfig.findUnique({
      where: { configKey },
    });

    if (!existing) {
      throw new NotFoundException(`설정을 찾을 수 없습니다: ${configKey}`);
    }

    await this.prisma.appConfig.delete({ where: { configKey } });

    this.logger.log(`설정 삭제: ${configKey}`);

    return { success: true };
  }

  /**
   * 설정 활성화/비활성화 토글
   */
  async toggleActive(configKey: string) {
    const existing = await this.prisma.appConfig.findUnique({
      where: { configKey },
    });

    if (!existing) {
      throw new NotFoundException(`설정을 찾을 수 없습니다: ${configKey}`);
    }

    const config = await this.prisma.appConfig.update({
      where: { configKey },
      data: { isActive: !existing.isActive },
    });

    this.logger.log(`설정 활성화 토글: ${configKey} -> ${config.isActive}`);

    return {
      ...config,
      configValue: config.isEncrypted ? '********' : config.configValue,
    };
  }
}
