import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CheckVersionDto } from './dto/check-version.dto';
import { CreateAppVersionDto } from './dto/create-app-version.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';
import { getNowKST } from '../common/utils/kst-date.util';

@Injectable()
export class AppVersionService {
  private readonly logger = new Logger(AppVersionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 버전 체크 (앱용)
   * 앱 시작 시 호출하여 업데이트/점검 여부 확인
   */
  async checkVersion(dto: CheckVersionDto) {
    this.logger.log(`버전 체크: ${dto.platform} v${dto.version}`);

    // 해당 플랫폼의 활성 버전 중 최신 버전 조회
    const latestVersion = await this.prisma.appVersion.findFirst({
      where: {
        platform: dto.platform,
        isActive: true,
      },
      orderBy: { releasedAt: 'desc' },
    });

    if (!latestVersion) {
      this.logger.warn(
        `[${dto.platform}] 활성 버전 정보가 없습니다. 버전 관리 페이지에서 등록해주세요.`,
      );
      return {
        needsUpdate: false,
        forceUpdate: false,
        latestVersion: dto.version,
        minRequiredVersion: dto.version,
        storeUrl: null,
        maintenance: false,
        maintenanceMessage: null,
      };
    }

    // 버전 비교 (semver)
    const currentVersion = this.parseVersion(dto.version);
    const minRequired = this.parseVersion(latestVersion.minRequiredVersion);
    const latest = this.parseVersion(latestVersion.version);

    const needsForceUpdate = this.compareVersions(currentVersion, minRequired) < 0;
    const needsUpdate = this.compareVersions(currentVersion, latest) < 0;

    return {
      needsUpdate,
      forceUpdate: needsForceUpdate || latestVersion.isForceUpdate,
      latestVersion: latestVersion.version,
      minRequiredVersion: latestVersion.minRequiredVersion,
      storeUrl: latestVersion.storeUrl,
      maintenance: latestVersion.isMaintenanceMode,
      maintenanceMessage: latestVersion.maintenanceMessage,
    };
  }

  /**
   * 버전 목록 조회 (어드민용)
   */
  async findAll(params: {
    platform?: string;
    page?: number;
    limit?: number;
  }) {
    const { platform, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where = platform ? { platform } : {};

    const [items, total] = await Promise.all([
      this.prisma.appVersion.findMany({
        where,
        orderBy: [{ platform: 'asc' }, { releasedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.appVersion.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 버전 상세 조회 (어드민용)
   */
  async findOne(id: number) {
    const version = await this.prisma.appVersion.findUnique({
      where: { id },
    });

    if (!version) {
      throw new NotFoundException(`버전 ID ${id}를 찾을 수 없습니다.`);
    }

    return version;
  }

  /**
   * 버전 등록 (어드민용)
   */
  async create(dto: CreateAppVersionDto) {
    this.logger.log(`버전 등록: ${dto.platform} v${dto.version}`);

    const version = await this.prisma.appVersion.create({
      data: {
        platform: dto.platform,
        version: dto.version,
        buildNumber: dto.buildNumber,
        minRequiredVersion: dto.minRequiredVersion,
        isForceUpdate: dto.isForceUpdate ?? false,
        isMaintenanceMode: dto.isMaintenanceMode ?? false,
        maintenanceMessage: dto.maintenanceMessage,
        releaseNotes: dto.releaseNotes,
        storeUrl: dto.storeUrl,
        isActive: dto.isActive ?? true,
        releasedAt: dto.releasedAt ? new Date(dto.releasedAt) : getNowKST(),
        createdAt: getNowKST(),
      },
    });

    return version;
  }

  /**
   * 버전 수정 (어드민용)
   */
  async update(id: number, dto: UpdateAppVersionDto) {
    this.logger.log(`버전 수정: ID ${id}`);

    await this.findOne(id);

    const version = await this.prisma.appVersion.update({
      where: { id },
      data: {
        ...(dto.version && { version: dto.version }),
        ...(dto.buildNumber !== undefined && { buildNumber: dto.buildNumber }),
        ...(dto.minRequiredVersion && { minRequiredVersion: dto.minRequiredVersion }),
        ...(dto.isForceUpdate !== undefined && { isForceUpdate: dto.isForceUpdate }),
        ...(dto.isMaintenanceMode !== undefined && { isMaintenanceMode: dto.isMaintenanceMode }),
        ...(dto.maintenanceMessage !== undefined && { maintenanceMessage: dto.maintenanceMessage }),
        ...(dto.releaseNotes !== undefined && { releaseNotes: dto.releaseNotes }),
        ...(dto.storeUrl !== undefined && { storeUrl: dto.storeUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.releasedAt && { releasedAt: new Date(dto.releasedAt) }),
      },
    });

    return version;
  }

  /**
   * 버전 삭제 (어드민용)
   */
  async remove(id: number) {
    this.logger.log(`버전 삭제: ID ${id}`);

    await this.findOne(id);

    await this.prisma.appVersion.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * 버전 문자열 파싱 (1.0.0 → [1, 0, 0])
   */
  private parseVersion(version: string): number[] {
    return version.split('.').map((v) => parseInt(v, 10) || 0);
  }

  /**
   * 버전 비교
   * @returns -1: a < b, 0: a === b, 1: a > b
   */
  private compareVersions(a: number[], b: number[]): number {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const aVal = a[i] || 0;
      const bVal = b[i] || 0;
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  }
}
