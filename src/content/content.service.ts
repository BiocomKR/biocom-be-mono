import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';
import { GoogleStorageService } from '../common/services/google-storage.service';
import * as DOMPurify from 'isomorphic-dompurify';
import * as crypto from 'crypto';
import { extname } from 'path';

export type ContentType = 'LECTURE' | 'COLUMN' | 'VIDEO';

export interface ContentFileDto {
  file: Express.Multer.File;
  sortOrder?: number;
}

/**
 * 백오피스 콘텐츠 관리 서비스
 */
@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleStorageService: GoogleStorageService,
  ) {}

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
          challenge: {
            select: {
              id: true,
              name: true,
            },
          },
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

    // 프론트엔드 형식에 맞게 변환
    const formattedItems = items.map((item) => ({
      ...item,
      challengeId: item.challenge?.id || null,
      challengeName: item.challenge?.name || null,
    }));

    return {
      items: formattedItems,
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
            file: true,
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
   * 파일을 GCS에 업로드하고 File 테이블에 저장
   */
  private async uploadAndSaveFile(file: Express.Multer.File): Promise<number> {
    // 안전한 파일명 생성
    const fileExt = extname(file.originalname).toLowerCase();
    const safeFileName = `content/${crypto.randomBytes(16).toString('hex')}${fileExt}`;

    // GCS 업로드
    const publicUrl = await this.googleStorageService.uploadFile(
      file.buffer,
      safeFileName,
      file.mimetype,
    );

    // File 테이블에 저장
    const fileRecord = await this.prisma.file.create({
      data: {
        originalName: file.originalname,
        storedName: safeFileName,
        filePath: publicUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageType: 'gcs',
        createdAt: getNowKST(),
      },
    });

    return fileRecord.id;
  }

  /**
   * 컨텐츠 생성
   */
  async createContent(
    data: {
      title: string;
      content: string;
      type: ContentType;
      isActive?: boolean | string;
      weekNumber?: number | string;
      dayNumber?: number | string;
      sortOrder?: number | string;
      points?: number | string;
      challengeId?: number | string;
    },
    files?: Express.Multer.File[],
  ) {
    const sanitizedContent = this.sanitizeHtml(data.content);

    // FormData에서 문자열로 올 수 있으므로 타입 변환
    const isActive = typeof data.isActive === 'string'
      ? data.isActive === 'true'
      : (data.isActive ?? true);
    const weekNumber = data.weekNumber ? Number(data.weekNumber) : null;
    const dayNumber = data.dayNumber ? Number(data.dayNumber) : null;
    const sortOrder = data.sortOrder ? Number(data.sortOrder) : 0;
    const points = data.points ? Number(data.points) : 0;
    const challengeId = data.challengeId ? Number(data.challengeId) : null;

    // 파일 업로드 먼저 처리 (트랜잭션 외부)
    const fileIds: number[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const fileId = await this.uploadAndSaveFile(file);
        fileIds.push(fileId);
      }
    }

    const content = await this.prisma.$transaction(async (tx) => {
      const newContent = await tx.content.create({
        data: {
          title: data.title,
          content: sanitizedContent,
          type: data.type,
          isActive,
          weekNumber,
          dayNumber,
          sortOrder,
          points,
          challengeId,
          createdAt: getNowKST(),
        },
      });

      // ContentFile 관계 생성
      if (fileIds.length > 0) {
        await tx.contentFile.createMany({
          data: fileIds.map((fileId, index) => ({
            contentId: newContent.id,
            fileId,
            sortOrder: index,
            createdAt: getNowKST(),
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
      isActive: boolean | string;
      weekNumber: number | string;
      dayNumber: number | string;
      sortOrder: number | string;
      points: number | string;
      challengeId: number | string;
      deleteFileIds: string; // JSON 문자열 "[1,2,3]" 형태
    }>,
    files?: Express.Multer.File[],
  ) {
    const existingContent = await this.getContentById(id);

    // FormData에서 문자열로 올 수 있으므로 타입 변환
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = this.sanitizeHtml(data.content);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.isActive !== undefined) {
      updateData.isActive = typeof data.isActive === 'string'
        ? data.isActive === 'true'
        : data.isActive;
    }
    if (data.weekNumber !== undefined) updateData.weekNumber = data.weekNumber ? Number(data.weekNumber) : null;
    if (data.dayNumber !== undefined) updateData.dayNumber = data.dayNumber ? Number(data.dayNumber) : null;
    if (data.sortOrder !== undefined) updateData.sortOrder = Number(data.sortOrder);
    if (data.points !== undefined) updateData.points = Number(data.points);
    if (data.challengeId !== undefined) updateData.challengeId = data.challengeId ? Number(data.challengeId) : null;

    // 삭제할 파일 ID 파싱
    let deleteFileIds: number[] = [];
    if (data.deleteFileIds) {
      try {
        deleteFileIds = JSON.parse(data.deleteFileIds);
      } catch {
        this.logger.warn(`deleteFileIds 파싱 실패: ${data.deleteFileIds}`);
      }
    }

    // 새 파일 업로드 처리 (트랜잭션 외부)
    const newFileIds: number[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const fileId = await this.uploadAndSaveFile(file);
        newFileIds.push(fileId);
      }
    }

    // 기존 파일의 최대 sortOrder 구하기
    const maxSortOrder = (existingContent as any).contentFiles?.length > 0
      ? Math.max(...(existingContent as any).contentFiles.map((cf: any) => cf.sortOrder))
      : -1;

    await this.prisma.$transaction(async (tx) => {
      await tx.content.update({
        where: { id },
        data: updateData,
      });

      // 삭제할 파일 관계 제거
      if (deleteFileIds.length > 0) {
        await tx.contentFile.deleteMany({
          where: {
            contentId: id,
            fileId: { in: deleteFileIds },
          },
        });
      }

      // 새 파일 추가 (기존 파일에 이어서)
      if (newFileIds.length > 0) {
        await tx.contentFile.createMany({
          data: newFileIds.map((fileId, index) => ({
            contentId: id,
            fileId,
            sortOrder: maxSortOrder + 1 + index,
            createdAt: getNowKST(),
          })),
        });
      }
    });

    return this.getContentById(id);
  }

  /**
   * 컨텐츠 삭제 (소프트 딜리트 - isActive: false)
   */
  async deleteContent(id: number) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
        challengeId: true,
      },
    });

    if (!content) {
      throw new NotFoundException(`컨텐츠를 찾을 수 없습니다: ${id}`);
    }

    if (content.challengeId) {
      throw new BadRequestException(
        `챌린지에서 사용 중인 컨텐츠는 삭제할 수 없습니다.`
      );
    }

    // 소프트 딜리트: isActive를 false로 변경
    await this.prisma.content.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`컨텐츠 소프트 삭제 완료: ${id}`);
  }
}
