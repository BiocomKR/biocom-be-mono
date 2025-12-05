/**
 * 앱 버전 관리 서비스 (백오피스)
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateAppVersionDto,
  UpdateAppVersionDto,
  AppVersionQueryDto,
} from './dto/app-version.dto';

@Injectable()
export class AppVersionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 앱 버전 목록 조회
   */
  async findAll(query: AppVersionQueryDto) {
    const { platform, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (platform) {
      where.platform = platform;
    }

    const [items, total] = await Promise.all([
      this.prisma.appVersion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
   * 앱 버전 상세 조회
   */
  async findOne(id: number) {
    const version = await this.prisma.appVersion.findUnique({
      where: { id },
    });

    if (!version) {
      throw new NotFoundException('앱 버전을 찾을 수 없습니다.');
    }

    return version;
  }

  /**
   * 앱 버전 등록
   */
  async create(dto: CreateAppVersionDto) {
    // 중복 체크
    const existing = await this.prisma.appVersion.findFirst({
      where: {
        platform: dto.platform,
        version: dto.version,
      },
    });

    if (existing) {
      throw new ConflictException('이미 등록된 버전입니다.');
    }

    return this.prisma.appVersion.create({
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
        releasedAt: dto.releasedAt ? new Date(dto.releasedAt) : null,
      },
    });
  }

  /**
   * 앱 버전 수정
   */
  async update(id: number, dto: UpdateAppVersionDto) {
    const version = await this.prisma.appVersion.findUnique({
      where: { id },
    });

    if (!version) {
      throw new NotFoundException('앱 버전을 찾을 수 없습니다.');
    }

    // 버전 변경 시 중복 체크
    if (dto.version && dto.version !== version.version) {
      const existing = await this.prisma.appVersion.findFirst({
        where: {
          platform: dto.platform || version.platform,
          version: dto.version,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('이미 등록된 버전입니다.');
      }
    }

    return this.prisma.appVersion.update({
      where: { id },
      data: {
        ...dto,
        releasedAt: dto.releasedAt ? new Date(dto.releasedAt) : undefined,
      },
    });
  }

  /**
   * 앱 버전 삭제
   */
  async remove(id: number) {
    const version = await this.prisma.appVersion.findUnique({
      where: { id },
    });

    if (!version) {
      throw new NotFoundException('앱 버전을 찾을 수 없습니다.');
    }

    await this.prisma.appVersion.delete({
      where: { id },
    });

    return { success: true, message: '앱 버전이 삭제되었습니다.' };
  }
}
