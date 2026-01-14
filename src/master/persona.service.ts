import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';

interface GetPersonasParams {
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

@Injectable()
export class PersonaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 페르소나 목록 조회
   */
  async getPersonas(params: GetPersonasParams) {
    const {
      search,
      isActive,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
      page = 1,
      limit = 10,
    } = params;

    const where: any = {};

    // 검색어 필터
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // 활성화 상태 필터
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // 정렬 설정
    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    }

    // 전체 개수 조회
    const total = await this.prisma.aiPersona.count({ where });

    // 목록 조회
    const personas = await this.prisma.aiPersona.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return {
      items: personas.map((persona) => ({
        ...persona,
        userCount: persona._count.users,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 페르소나 상세 조회
   */
  async getPersonaById(id: number) {
    const persona = await this.prisma.aiPersona.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!persona) {
      throw new NotFoundException('페르소나를 찾을 수 없습니다.');
    }

    return {
      ...persona,
      userCount: persona._count.users,
    };
  }

  /**
   * 페르소나 생성
   */
  async createPersona(dto: any) {
    const now = getNowKST();

    const persona = await this.prisma.aiPersona.create({
      data: {
        name: dto.name,
        description: dto.description,
        personality: dto.personality,
        personaUrl: dto.personaUrl,
        thumbnailUrl: dto.thumbnailUrl,
        torsoUrl: dto.torsoUrl,
        torsoBgUrl: dto.torsoBgUrl,
        chatIconUrl: dto.chatIconUrl,
        personaAnimationUrl: dto.personaAnimationUrl,
        systemPrompt: dto.systemPrompt,
        greeting: dto.greeting,
        challengeDescription: dto.challengeDescription,
        gender: dto.gender,
        introTitle: dto.introTitle,
        introContent: dto.introContent,
        hashtags: dto.hashtags,
        featureTitle: dto.featureTitle,
        featureContent: dto.featureContent,
        speechTitle: dto.speechTitle,
        speechContent: dto.speechContent,
        speechImageUrl: dto.speechImageUrl,
        intimacyTitle: dto.intimacyTitle,
        intimacyContent: dto.intimacyContent,
        intimacyImageUrl: dto.intimacyImageUrl,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        createdAt: now,
      },
    });

    return this.getPersonaById(persona.id);
  }

  /**
   * 페르소나 수정
   */
  async updatePersona(id: number, dto: any) {
    const existing = await this.prisma.aiPersona.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('페르소나를 찾을 수 없습니다.');
    }

    await this.prisma.aiPersona.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        personality: dto.personality,
        personaUrl: dto.personaUrl,
        thumbnailUrl: dto.thumbnailUrl,
        torsoUrl: dto.torsoUrl,
        torsoBgUrl: dto.torsoBgUrl,
        chatIconUrl: dto.chatIconUrl,
        personaAnimationUrl: dto.personaAnimationUrl,
        systemPrompt: dto.systemPrompt,
        greeting: dto.greeting,
        challengeDescription: dto.challengeDescription,
        gender: dto.gender,
        introTitle: dto.introTitle,
        introContent: dto.introContent,
        hashtags: dto.hashtags,
        featureTitle: dto.featureTitle,
        featureContent: dto.featureContent,
        speechTitle: dto.speechTitle,
        speechContent: dto.speechContent,
        speechImageUrl: dto.speechImageUrl,
        intimacyTitle: dto.intimacyTitle,
        intimacyContent: dto.intimacyContent,
        intimacyImageUrl: dto.intimacyImageUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });

    return this.getPersonaById(id);
  }

  /**
   * 페르소나 삭제
   */
  async deletePersona(id: number) {
    const persona = await this.prisma.aiPersona.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!persona) {
      throw new NotFoundException('페르소나를 찾을 수 없습니다.');
    }

    // 사용 중인 사용자가 있으면 삭제 불가
    if (persona._count.users > 0) {
      throw new NotFoundException(
        '이 페르소나를 사용 중인 사용자가 있어 삭제할 수 없습니다. 비활성화를 사용해주세요.',
      );
    }

    await this.prisma.aiPersona.delete({
      where: { id },
    });

    return { success: true, message: '페르소나가 삭제되었습니다.' };
  }

  /**
   * 페르소나 활성화/비활성화 토글
   */
  async togglePersonaActive(id: number) {
    const persona = await this.prisma.aiPersona.findUnique({
      where: { id },
    });

    if (!persona) {
      throw new NotFoundException('페르소나를 찾을 수 없습니다.');
    }

    const updated = await this.prisma.aiPersona.update({
      where: { id },
      data: { isActive: !persona.isActive },
    });

    return {
      success: true,
      isActive: updated.isActive,
      message: updated.isActive ? '페르소나가 활성화되었습니다.' : '페르소나가 비활성화되었습니다.',
    };
  }
}
