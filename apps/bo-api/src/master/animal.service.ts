import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';

interface GetAnimalsParams {
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface AnimalFileDto {
  fileId: number;
  imageType: string;
  sortOrder?: number;
}

@Injectable()
export class AnimalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 동물 목록 조회
   */
  async getAnimals(params: GetAnimalsParams) {
    const {
      search,
      isActive,
      sortBy = 'id',
      sortOrder = 'asc',
      page = 1,
      limit = 10,
    } = params;

    const where: any = {};

    // 검색어 필터
    if (search) {
      where.OR = [
        { healthType: { contains: search } },
        { typeName: { contains: search } },
        { animalName: { contains: search } },
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
    const total = await this.prisma.healthTypeAnimal.count({ where });

    // 목록 조회
    const animals = await this.prisma.healthTypeAnimal.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        images: {
          include: {
            file: true,
          },
          orderBy: [
            { imageType: 'asc' },
            { sortOrder: 'asc' },
          ],
        },
        _count: {
          select: {
            users: true,
            recommendedProducts: true,
          },
        },
      },
    });

    return {
      items: animals.map((animal) => ({
        ...animal,
        userCount: animal._count.users,
        productCount: animal._count.recommendedProducts,
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
   * 동물 상세 조회
   */
  async getAnimalById(id: number) {
    const animal = await this.prisma.healthTypeAnimal.findUnique({
      where: { id },
      include: {
        images: {
          include: {
            file: true,
          },
          orderBy: [
            { imageType: 'asc' },
            { sortOrder: 'asc' },
          ],
        },
        recommendedProducts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                productFiles: {
                  orderBy: { sortOrder: 'asc' },
                  include: { file: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!animal) {
      throw new NotFoundException('동물을 찾을 수 없습니다.');
    }

    return {
      ...animal,
      userCount: animal._count.users,
      recommendedProducts: animal.recommendedProducts.map((rp) => ({
        ...rp,
        product: {
          id: rp.product.id,
          name: rp.product.name,
          imageUrl: rp.product.productFiles?.[0]?.file?.filePath || null,
        },
      })),
    };
  }

  /**
   * 동물 생성
   */
  async createAnimal(dto: any) {
    const {
      healthType,
      typeName,
      animalName,
      catchphrase,
      symptoms,
      description,
      solution,
      imageUrl,
      metadata,
      isActive,
      files,
    } = dto;

    // healthType 중복 체크
    const existing = await this.prisma.healthTypeAnimal.findUnique({
      where: { healthType },
    });
    if (existing) {
      throw new BadRequestException('이미 존재하는 건강타입입니다.');
    }

    const now = getNowKST();

    const animal = await this.prisma.healthTypeAnimal.create({
      data: {
        healthType,
        typeName,
        animalName,
        catchphrase,
        symptoms,
        description,
        solution,
        imageUrl,
        metadata,
        isActive: isActive ?? true,
        createdAt: now,
      },
    });

    // 파일 연결
    if (files && files.length > 0) {
      await this.prisma.healthTypeAnimalFile.createMany({
        data: files.map((file: AnimalFileDto, index: number) => ({
          healthTypeAnimalId: animal.id,
          fileId: file.fileId,
          imageType: file.imageType,
          sortOrder: file.sortOrder ?? index,
          createdAt: now,
        })),
      });
    }

    return this.getAnimalById(animal.id);
  }

  /**
   * 동물 수정
   */
  async updateAnimal(id: number, dto: any) {
    const existing = await this.prisma.healthTypeAnimal.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('동물을 찾을 수 없습니다.');
    }

    const {
      healthType,
      typeName,
      animalName,
      catchphrase,
      symptoms,
      description,
      solution,
      imageUrl,
      metadata,
      isActive,
      files,
    } = dto;

    // healthType 중복 체크 (자기 자신 제외)
    if (healthType && healthType !== existing.healthType) {
      const duplicate = await this.prisma.healthTypeAnimal.findFirst({
        where: { healthType, id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestException('이미 존재하는 건강타입입니다.');
      }
    }

    await this.prisma.healthTypeAnimal.update({
      where: { id },
      data: {
        healthType,
        typeName,
        animalName,
        catchphrase,
        symptoms,
        description,
        solution,
        imageUrl,
        metadata,
        isActive,
      },
    });

    // 파일 연결 업데이트
    if (files !== undefined) {
      const now = getNowKST();

      // 기존 연결 삭제
      await this.prisma.healthTypeAnimalFile.deleteMany({
        where: { healthTypeAnimalId: id },
      });

      // 새 연결 생성
      if (files && files.length > 0) {
        await this.prisma.healthTypeAnimalFile.createMany({
          data: files.map((file: AnimalFileDto, index: number) => ({
            healthTypeAnimalId: id,
            fileId: file.fileId,
            imageType: file.imageType,
            sortOrder: file.sortOrder ?? index,
            createdAt: now,
          })),
        });
      }
    }

    return this.getAnimalById(id);
  }

  /**
   * 동물 삭제
   */
  async deleteAnimal(id: number) {
    const animal = await this.prisma.healthTypeAnimal.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!animal) {
      throw new NotFoundException('동물을 찾을 수 없습니다.');
    }

    // 사용 중인 사용자가 있으면 삭제 불가
    if (animal._count.users > 0) {
      throw new BadRequestException(
        '이 동물을 사용 중인 사용자가 있어 삭제할 수 없습니다. 비활성화를 사용해주세요.',
      );
    }

    // 파일 연결 먼저 삭제 (Cascade로 자동 삭제되지만 명시적으로)
    await this.prisma.healthTypeAnimalFile.deleteMany({
      where: { healthTypeAnimalId: id },
    });

    await this.prisma.healthTypeAnimal.delete({
      where: { id },
    });

    return { success: true, message: '동물이 삭제되었습니다.' };
  }

  /**
   * 동물 활성화/비활성화 토글
   */
  async toggleAnimalActive(id: number) {
    const animal = await this.prisma.healthTypeAnimal.findUnique({
      where: { id },
    });

    if (!animal) {
      throw new NotFoundException('동물을 찾을 수 없습니다.');
    }

    const updated = await this.prisma.healthTypeAnimal.update({
      where: { id },
      data: { isActive: !animal.isActive },
    });

    return {
      success: true,
      isActive: updated.isActive,
      message: updated.isActive ? '동물이 활성화되었습니다.' : '동물이 비활성화되었습니다.',
    };
  }

  /**
   * 동물 파일 추가
   */
  async addAnimalFile(animalId: number, dto: AnimalFileDto) {
    const animal = await this.prisma.healthTypeAnimal.findUnique({
      where: { id: animalId },
    });

    if (!animal) {
      throw new NotFoundException('동물을 찾을 수 없습니다.');
    }

    const now = getNowKST();

    // 같은 타입의 마지막 sortOrder 조회
    const lastFile = await this.prisma.healthTypeAnimalFile.findFirst({
      where: {
        healthTypeAnimalId: animalId,
        imageType: dto.imageType,
      },
      orderBy: { sortOrder: 'desc' },
    });

    const newSortOrder = dto.sortOrder ?? (lastFile ? lastFile.sortOrder + 1 : 0);

    const file = await this.prisma.healthTypeAnimalFile.create({
      data: {
        healthTypeAnimalId: animalId,
        fileId: dto.fileId,
        imageType: dto.imageType,
        sortOrder: newSortOrder,
        createdAt: now,
      },
      include: {
        file: true,
      },
    });

    return file;
  }

  /**
   * 동물 파일 삭제
   */
  async removeAnimalFile(animalId: number, fileRelationId: number) {
    const fileRelation = await this.prisma.healthTypeAnimalFile.findFirst({
      where: {
        id: fileRelationId,
        healthTypeAnimalId: animalId,
      },
    });

    if (!fileRelation) {
      throw new NotFoundException('파일 연결을 찾을 수 없습니다.');
    }

    await this.prisma.healthTypeAnimalFile.delete({
      where: { id: fileRelationId },
    });

    return { success: true, message: '파일이 삭제되었습니다.' };
  }

  /**
   * 동물 파일 순서 변경
   */
  async reorderAnimalFiles(animalId: number, fileOrders: { id: number; sortOrder: number }[]) {
    const animal = await this.prisma.healthTypeAnimal.findUnique({
      where: { id: animalId },
    });

    if (!animal) {
      throw new NotFoundException('동물을 찾을 수 없습니다.');
    }

    await Promise.all(
      fileOrders.map((order) =>
        this.prisma.healthTypeAnimalFile.update({
          where: { id: order.id },
          data: { sortOrder: order.sortOrder },
        }),
      ),
    );

    return { success: true, message: '파일 순서가 변경되었습니다.' };
  }
}
