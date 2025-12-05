import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CheckVersionDto } from './dto/check-version.dto';

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
