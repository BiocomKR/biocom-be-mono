import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  HealthTypeAnimalDto,
  HealthTypeAnimalListResponseDto,
} from './dto/health-type-animal.dto';

@Injectable()
export class HealthTypeAnimalService {
  private readonly logger = new Logger(HealthTypeAnimalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 동물 목록 조회
   * 로그인한 사용자의 경우 내 동물 표시
   */
  async getAnimalList(userId?: number): Promise<HealthTypeAnimalListResponseDto> {
    this.logger.log(`동물 목록 조회 - userId: ${userId || 'none'}`);

    // 사용자의 동물 ID 조회
    let myAnimalId: number | null = null;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { health_type_animal_id: true },
      });
      myAnimalId = user?.health_type_animal_id || null;
    }

    // 활성화된 동물 목록 조회
    const animals = await this.prisma.healthTypeAnimal.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      include: {
        images: {
          orderBy: [{ imageType: 'asc' }, { sortOrder: 'asc' }],
          include: {
            file: { select: { filePath: true } },
          },
        },
      },
    });

    const animalDtos: HealthTypeAnimalDto[] = animals.map((animal) => ({
      id: animal.id,
      healthType: animal.healthType,
      typeName: animal.typeName,
      animalName: animal.animalName,
      catchphrase: animal.catchphrase,
      symptoms: animal.symptoms,
      description: animal.description || undefined,
      solution: animal.solution || undefined,
      imageUrl: animal.imageUrl || undefined,
      metadata: animal.metadata || undefined,
      images: animal.images.map((img) => ({
        imageType: img.imageType,
        imageUrl: img.file?.filePath || '',
        sortOrder: img.sortOrder,
      })),
      isMine: animal.id === myAnimalId,
    }));

    return {
      animals: animalDtos,
      myAnimalId,
      total: animalDtos.length,
    };
  }
}
