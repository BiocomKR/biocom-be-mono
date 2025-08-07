import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { PaginationHelper, PaginatedResult } from '../common/utils/pagination.util';
import { CreateContentDto, UpdateContentDto, ContentFileDto } from './content.types';
import * as DOMPurify from 'isomorphic-dompurify';

/**
 * 컨텐츠 관리 서비스
 */
@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * HTML 컨텐츠 sanitize
   * XSS 공격 방지를 위한 HTML 정제
   */
  private sanitizeHtml(html: string): string {
    // 허용할 태그와 속성 설정
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
   * 컨텐츠 생성
   */
  async createContent(data: CreateContentDto, files?: ContentFileDto[]): Promise<any> {
    this.logger.log(`컨텐츠 생성 - 제목: ${data.title}`);

    // HTML 컨텐츠 sanitize
    const sanitizedContent = this.sanitizeHtml(data.content);

    const content = await this.prisma.$transaction(async (tx) => {
      // 컨텐츠 생성
      const newContent = await tx.content.create({
        data: {
          title: data.title,
          content: sanitizedContent,
          type: data.type,
          isActive: data.isActive ?? true,
        },
      });

      // 첨부파일이 있으면 저장
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

    this.logger.log(`컨텐츠 생성 완료 - ID: ${content.id}`);
    return this.getContentById(content.id);
  }

  /**
   * 컨텐츠 상세 조회
   */
  async getContentById(id: number): Promise<any> {
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        contentFiles: {
          orderBy: { sortOrder: 'asc' },
        },
        eventContents: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
              },
            },
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
   * 컨텐츠 수정
   */
  async updateContent(
    id: number,
    data: UpdateContentDto,
    files?: ContentFileDto[]
  ): Promise<any> {
    this.logger.log(`컨텐츠 수정 - ID: ${id}`);

    // 존재 확인
    await this.getContentById(id);

    // HTML 컨텐츠 sanitize
    if (data.content) {
      data.content = this.sanitizeHtml(data.content);
    }

    const content = await this.prisma.$transaction(async (tx) => {
      // 컨텐츠 업데이트
      const updated = await tx.content.update({
        where: { id },
        data,
      });

      // 새로운 파일이 있으면 기존 파일 삭제 후 새로 저장
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

    this.logger.log(`컨텐츠 수정 완료 - ID: ${id}`);
    return this.getContentById(id);
  }

  /**
   * 컨텐츠 삭제
   */
  async deleteContent(id: number): Promise<void> {
    this.logger.log(`컨텐츠 삭제 - ID: ${id}`);

    // 이벤트와 연결된 컨텐츠인지 확인
    const eventContentCount = await this.prisma.eventContent.count({
      where: { contentId: id },
    });

    if (eventContentCount > 0) {
      throw new BadRequestException(
        `이벤트에서 사용 중인 컨텐츠는 삭제할 수 없습니다. (연결된 이벤트 수: ${eventContentCount})`
      );
    }

    await this.prisma.content.delete({
      where: { id },
    });

    this.logger.log(`컨텐츠 삭제 완료 - ID: ${id}`);
  }

  /**
   * 페이징 처리된 컨텐츠 목록 조회
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
  ): Promise<PaginatedResult<any>> {
    this.logger.log(`페이징 처리된 컨텐츠 목록 조회 - page: ${page}, limit: ${limit}`);

    // WHERE 조건 구성
    const where: any = {};

    // 검색어 필터
    if (filters.search) {
      const searchCondition = PaginationHelper.createSearchCondition(
        filters.search,
        ['title', 'content']
      );
      if (searchCondition) {
        Object.assign(where, searchCondition);
      }
    }

    // 타입 필터
    if (filters.type) {
      where.type = filters.type;
    }

    // 활성화 상태 필터
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // 페이징 처리
    const result = await PaginationHelper.paginate<any>(
      this.prisma.content,
      { page, limit },
      {
        where,
        include: {
          _count: {
            select: {
              contentFiles: true,
              eventContents: true,
            },
          },
        },
      },
      sort
    );

    this.logger.log(`페이징 처리된 컨텐츠 목록 조회 완료 - 총 ${result.total}개`);

    return result;
  }
}