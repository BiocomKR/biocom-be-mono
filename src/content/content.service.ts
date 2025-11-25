import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';
import * as DOMPurify from 'isomorphic-dompurify';

export type ContentType = 'LECTURE' | 'COLUMN' | 'VIDEO';

export interface ContentFileDto {
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  sortOrder?: number;
}

/**
 * 백오피스 콘텐츠 관리 서비스
 */
@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * HTML 컨텐츠 sanitize
   */
  private sanitizeHtml(html: string): string {
    const config = {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'a', 'ul', 'ol', 'li', 'img', 'div', 'span',
        'table', 'thead', 'tbody', 'tr', 'td', 'th'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'width', 'height', 'style',
        'class', 'id', 'target', 'rel'
      ],
      ALLOWED_SCHEMES: ['http', 'https', 'mailto'],
      ALLOW_DATA_ATTR: false
    };

    return DOMPurify.sanitize(html, config);
  }

  /**
   * 컨텐츠 목록 조회 (페이징)
   */
  async getContentsWithPagination(
    page: number,
    limit: number,
    filters: {
      search?: string;
      type?: string;
      isActive?: boolean;
    },
    sort: {
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.type) where.type = filters.type;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [items, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        include: {
          _count: {
            select: {
              contentFiles: true,
              quizAttempts: true,
            },
          },
        },
        orderBy: { [sort.sortBy]: sort.sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 컨텐츠 상세 조회
   */
  async getContentById(id: number) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        contentFiles: {
          include: {
            file: true
          },
          orderBy: { sortOrder: 'asc' },
        },
        challenge: {
          select: {
            id: true,
            name: true,
            metadata: true,
          },
        },
      },
    });

    if (!content) {
      throw new NotFoundException(`컨텐츠를 찾을 수 없습니다: ${id}`);
    }

    return content;
  }

  /**
   * 컨텐츠 생성
   */
  async createContent(data: {
    title: string;
    content: string;
    type: ContentType;
    isActive?: boolean;
  }, files?: ContentFileDto[]) {
    const sanitizedContent = this.sanitizeHtml(data.content);

    const content = await this.prisma.$transaction(async (tx) => {
      const newContent = await tx.content.create({
        data: {
          title: data.title,
          content: sanitizedContent,
          type: data.type,
          isActive: data.isActive ?? true,
          createdAt: getNowKST(),
        },
      });

      if (files && files.length > 0) {
        await tx.contentFile.createMany({
          data: files.map((file, index) => ({
            contentId: newContent.id,
            fileUrl: file.fileUrl,
            fileName: file.fileName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            sortOrder: file.sortOrder ?? index,
          })),
        });
      }

      return newContent;
    });

    return this.getContentById(content.id);
  }

  /**
   * 컨텐츠 수정
   */
  async updateContent(
    id: number,
    data: Partial<{
      title: string;
      content: string;
      type: ContentType;
      isActive: boolean;
    }>,
    files?: ContentFileDto[]
  ) {
    await this.getContentById(id);

    if (data.content) {
      data.content = this.sanitizeHtml(data.content);
    }

    const content = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.content.update({
        where: { id },
        data,
      });

      if (files && files.length > 0) {
        await tx.contentFile.deleteMany({
          where: { contentId: id },
        });

        await tx.contentFile.createMany({
          data: files.map((file, index) => ({
            contentId: id,
            fileUrl: file.fileUrl,
            fileName: file.fileName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            sortOrder: file.sortOrder ?? index,
          })),
        });
      }

      return updated;
    });

    return this.getContentById(id);
  }

  /**
   * 컨텐츠 삭제
   */
  async deleteContent(id: number) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      select: { challengeId: true },
    });

    if (content?.challengeId) {
      throw new BadRequestException(
        `챌린지에서 사용 중인 컨텐츠는 삭제할 수 없습니다.`
      );
    }

    await this.prisma.content.delete({
      where: { id },
    });
  }
}
