import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UpdateUserConsentsDto } from './dto/update-user-consents.dto';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 활성 약관 목록 조회
   * 유저에게 보여줄 현재 활성화된 약관 목록
   * @param category 카테고리 필터 (선택)
   */
  async getActiveConsents(category?: string) {
    this.logger.log(`활성 약관 목록 조회${category ? ` (category: ${category})` : ''}`);

    const consents = await this.prisma.consent.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(category && { category }),
      },
      select: {
        id: true,
        code: true,
        title: true,
        content: true,
        version: true,
        category: true,
        isRequired: true,
        displayOrder: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    return consents;
  }

  /**
   * 사용자의 약관 동의 현황 조회
   */
  async getUserConsents(userId: number) {
    this.logger.log(`사용자 ${userId}의 약관 동의 현황 조회`);

    // 활성 약관 목록
    const activeConsents = await this.prisma.consent.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: { displayOrder: 'asc' },
    });

    // 사용자의 동의 내역
    const userConsents = await this.prisma.userConsent.findMany({
      where: { userId },
      include: {
        consent: {
          select: {
            id: true,
            code: true,
            title: true,
            version: true,
            isRequired: true,
          },
        },
      },
    });

    // 활성 약관 기준으로 동의 현황 매핑
    const result = activeConsents.map((consent) => {
      const userConsent = userConsents.find((uc) => uc.consentId === consent.id);
      return {
        consentId: consent.id,
        code: consent.code,
        title: consent.title,
        version: consent.version,
        isRequired: consent.isRequired,
        isAgreed: userConsent?.isAgreed ?? false,
        agreedAt: userConsent?.agreedAt ?? null,
      };
    });

    return result;
  }

  /**
   * 사용자 약관 동의/철회 처리
   */
  async updateUserConsents(userId: number, dto: UpdateUserConsentsDto) {
    this.logger.log(`사용자 ${userId}의 약관 동의 처리`);

    // 1. 활성 필수 약관 조회
    const requiredConsents = await this.prisma.consent.findMany({
      where: {
        isRequired: true,
        isActive: true,
        deletedAt: null,
      },
    });

    // 2. 필수 약관 동의 여부 검증
    for (const required of requiredConsents) {
      const userConsent = dto.consents.find((c) => c.consentId === required.id);
      if (!userConsent || !userConsent.isAgreed) {
        throw new BadRequestException(
          `필수 약관 '${required.title}'에 동의해야 합니다.`,
        );
      }
    }

    // 3. 동의 내역 저장 (upsert)
    const now = new Date();
    const results = [];

    for (const consent of dto.consents) {
      const result = await this.prisma.userConsent.upsert({
        where: {
          userId_consentId: {
            userId,
            consentId: consent.consentId,
          },
        },
        update: {
          isAgreed: consent.isAgreed,
          agreedAt: consent.isAgreed ? now : null,
        },
        create: {
          userId,
          consentId: consent.consentId,
          isAgreed: consent.isAgreed,
          agreedAt: consent.isAgreed ? now : null,
        },
      });
      results.push(result);
    }

    this.logger.log(`사용자 ${userId}의 약관 동의 처리 완료 - ${results.length}건`);

    return this.getUserConsents(userId);
  }
}
