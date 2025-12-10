import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { GoogleStorageService } from '../common/services/google-storage.service';
import { getNowKST } from '../common/utils/kst-date.util';
import * as crypto from 'crypto';
import { extname } from 'path';

/** 이미지 타입 */
export enum AnimalImageType {
  /** 썸네일 이미지 */
  THUMBNAIL = 'THUMBNAIL',
  /** 설명 이미지 */
  DESCRIPTION = 'DESCRIPTION',
}

@Injectable()
export class HealthTypeAnimalsService {
  private readonly logger = new Logger(HealthTypeAnimalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleStorageService: GoogleStorageService,
  ) {}

  /**
   * 건강 타입 동물 목록 조회
   */
  async findAll() {
    return this.prisma.healthTypeAnimal.findMany({
      include: {
        images: {
          include: {
            file: true,
          },
          orderBy: [{ imageType: 'asc' }, { sortOrder: 'asc' }],
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * 건강 타입 동물 단일 조회
   */
  async findOne(id: number) {
    const animal = await this.prisma.healthTypeAnimal.findUnique({
      where: { id },
      include: {
        images: {
          include: {
            file: true,
          },
          orderBy: [{ imageType: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    });

    if (!animal) {
      throw new NotFoundException(`건강 타입 동물 ID ${id}를 찾을 수 없습니다.`);
    }

    return animal;
  }

  /**
   * 이미지 업로드 및 매핑
   * 1. File 테이블에 파일 정보 저장
   * 2. HealthTypeAnimalFile 테이블에 매핑 정보 저장
   */
  async uploadAndMapImage(
    healthTypeAnimalId: number,
    file: Express.Multer.File,
    imageType: AnimalImageType,
    sortOrder: number = 0,
  ) {
    this.logger.log(
      `이미지 업로드 시작 - animalId: ${healthTypeAnimalId}, type: ${imageType}`,
    );

    // 1. 건강 타입 동물 존재 확인
    const animal = await this.prisma.healthTypeAnimal.findUnique({
      where: { id: healthTypeAnimalId },
    });

    if (!animal) {
      throw new NotFoundException(
        `건강 타입 동물 ID ${healthTypeAnimalId}를 찾을 수 없습니다.`,
      );
    }

    // 2. 파일 검증
    if (!file || (!file.buffer && !file.path)) {
      throw new BadRequestException('파일이 업로드되지 않았습니다.');
    }

    // 파일 버퍼 준비
    let fileBuffer: Buffer;
    if (file.buffer) {
      fileBuffer = file.buffer;
    } else if (file.path) {
      const fs = require('fs');
      fileBuffer = fs.readFileSync(file.path);
      // 임시 파일 삭제
      setTimeout(() => {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // 무시
        }
      }, 1000);
    } else {
      throw new BadRequestException('파일 데이터가 없습니다.');
    }

    // 3. 안전한 파일명 생성
    const fileExt = extname(file.originalname).toLowerCase();
    const safeFileName = `health-type-animals/${healthTypeAnimalId}/${imageType.toLowerCase()}_${crypto.randomBytes(8).toString('hex')}${fileExt}`;

    // 4. Google Cloud Storage에 업로드
    const publicUrl = await this.googleStorageService.uploadFile(
      fileBuffer,
      safeFileName,
      file.mimetype,
    );

    // 5. 트랜잭션으로 File + HealthTypeAnimalFile 저장
    const result = await this.prisma.$transaction(async (tx) => {
      // File 테이블에 저장
      const fileRecord = await tx.file.create({
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

      // HealthTypeAnimalFile 테이블에 매핑 저장
      const animalFile = await tx.healthTypeAnimalFile.create({
        data: {
          healthTypeAnimalId,
          fileId: fileRecord.id,
          imageType,
          sortOrder,
          createdAt: getNowKST(),
        },
        include: {
          file: true,
        },
      });

      return animalFile;
    });

    this.logger.log(
      `이미지 업로드 완료 - animalId: ${healthTypeAnimalId}, fileId: ${result.fileId}, url: ${publicUrl}`,
    );

    return {
      id: result.id,
      healthTypeAnimalId: result.healthTypeAnimalId,
      fileId: result.fileId,
      imageType: result.imageType,
      sortOrder: result.sortOrder,
      filePath: result.file.filePath,
      originalName: result.file.originalName,
    };
  }

  /**
   * 이미지 매핑 삭제
   * File 레코드와 GCS 파일도 함께 삭제
   */
  async deleteImage(healthTypeAnimalFileId: number) {
    this.logger.log(`이미지 삭제 시작 - id: ${healthTypeAnimalFileId}`);

    const animalFile = await this.prisma.healthTypeAnimalFile.findUnique({
      where: { id: healthTypeAnimalFileId },
      include: { file: true },
    });

    if (!animalFile) {
      throw new NotFoundException(
        `이미지 매핑 ID ${healthTypeAnimalFileId}를 찾을 수 없습니다.`,
      );
    }

    // 1. GCS에서 파일 삭제
    try {
      const fileName = animalFile.file.storedName;
      await this.googleStorageService.deleteFile(fileName);
    } catch (error) {
      this.logger.warn(`GCS 파일 삭제 실패 (무시): ${error.message}`);
    }

    // 2. DB에서 삭제 (cascade로 HealthTypeAnimalFile도 삭제됨)
    await this.prisma.file.delete({
      where: { id: animalFile.fileId },
    });

    this.logger.log(`이미지 삭제 완료 - id: ${healthTypeAnimalFileId}`);

    return { deleted: true };
  }

  /**
   * 이미지 정렬 순서 변경
   */
  async updateImageSortOrder(healthTypeAnimalFileId: number, sortOrder: number) {
    const animalFile = await this.prisma.healthTypeAnimalFile.findUnique({
      where: { id: healthTypeAnimalFileId },
    });

    if (!animalFile) {
      throw new NotFoundException(
        `이미지 매핑 ID ${healthTypeAnimalFileId}를 찾을 수 없습니다.`,
      );
    }

    return this.prisma.healthTypeAnimalFile.update({
      where: { id: healthTypeAnimalFileId },
      data: { sortOrder },
      include: { file: true },
    });
  }
}
