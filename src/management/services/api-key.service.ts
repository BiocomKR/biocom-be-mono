import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ApiKey } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * API Key 관리 서비스
 * API Key의 생성, 조회, 활성화/비활성화 등을 관리
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 모든 API Key 목록 조회
   * 활성/비활성 상태 모두 포함
   */
  async findAll(): Promise<ApiKey[]> {
    this.logger.log('전체 API Key 목록 조회');
    
    return this.prisma.apiKey.findMany({
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * 특정 API Key 조회
   * ID로 API Key 정보 조회
   */
  async findOne(id: number): Promise<ApiKey> {
    this.logger.log(`API Key 조회 - ID: ${id}`);
    
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      throw new NotFoundException(`ID ${id}에 해당하는 API Key를 찾을 수 없습니다.`);
    }

    return apiKey;
  }

  /**
   * 새로운 API Key 생성
   * UUID 형식의 고유한 키 자동 생성
   */
  async create(name: string, description?: string): Promise<ApiKey> {
    this.logger.log(`새로운 API Key 생성 - 이름: ${name}`);
    
    // 동일한 이름의 API Key가 있는지 확인
    const existing = await this.prisma.apiKey.findFirst({
      where: { name },
    });

    if (existing) {
      throw new ConflictException(`이미 '${name}' 이름의 API Key가 존재합니다.`);
    }

    const newApiKey = await this.prisma.apiKey.create({
      data: {
        key: randomUUID(),
        name,
        description,
        createdAt: getNowKST(),
      },
    });

    this.logger.log(`API Key 생성 완료 - ID: ${newApiKey.id}, 이름: ${name}`);
    return newApiKey;
  }

  /**
   * API Key 활성화
   * 비활성화된 API Key를 다시 활성화
   */
  async activate(id: number): Promise<ApiKey> {
    this.logger.log(`API Key 활성화 - ID: ${id}`);
    
    const apiKey = await this.findOne(id);

    if (apiKey.isActive) {
      this.logger.warn(`API Key는 이미 활성화 상태입니다 - ID: ${id}`);
      return apiKey;
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: true },
    });

    this.logger.log(`API Key 활성화 완료 - ID: ${id}`);
    return updated;
  }

  /**
   * API Key 비활성화
   * 활성화된 API Key를 비활성화 (삭제하지 않음)
   */
  async deactivate(id: number): Promise<ApiKey> {
    this.logger.log(`API Key 비활성화 - ID: ${id}`);
    
    const apiKey = await this.findOne(id);

    if (!apiKey.isActive) {
      this.logger.warn(`API Key는 이미 비활성화 상태입니다 - ID: ${id}`);
      return apiKey;
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`API Key 비활성화 완료 - ID: ${id}`);
    return updated;
  }

  /**
   * API Key 재생성
   * 기존 API Key를 새로운 UUID로 교체
   */
  async regenerate(id: number): Promise<ApiKey> {
    this.logger.log(`API Key 재생성 - ID: ${id}`);
    
    await this.findOne(id);

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { 
        key: randomUUID(),
        lastUsedAt: null, // 재생성 시 마지막 사용 시간 초기화
      },
    });

    this.logger.log(`API Key 재생성 완료 - ID: ${id}`);
    return updated;
  }

  /**
   * API Key 삭제
   * 데이터베이스에서 완전히 삭제
   */
  async remove(id: number): Promise<void> {
    this.logger.log(`API Key 삭제 - ID: ${id}`);
    
    await this.findOne(id);

    await this.prisma.apiKey.delete({
      where: { id },
    });

    this.logger.log(`API Key 삭제 완료 - ID: ${id}`);
  }
}