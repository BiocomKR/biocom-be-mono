import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateAiCharacterDto,
  UpdateAiCharacterDto,
  AiCharacterResponseDto,
  AiCharacterListResponseDto
} from './dto/ai-character.dto';

@Injectable()
export class AiCharacterService {
  private readonly logger = new Logger(AiCharacterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * AI 캐릭터 생성
   * 같은 이름의 캐릭터가 존재하는지 확인 후 생성
   */
  async createCharacter(dto: CreateAiCharacterDto): Promise<AiCharacterResponseDto> {
    this.logger.log(`AI 캐릭터 생성 시도: ${dto.name}`);

    // 같은 이름의 캐릭터가 이미 존재하는지 확인
    const existingCharacter = await this.prisma.aiCharacter.findFirst({
      where: { name: dto.name }
    });

    if (existingCharacter) {
      throw new ConflictException(`이미 '${dto.name}' 이름의 캐릭터가 존재합니다`);
    }

    try {
      const character = await this.prisma.aiCharacter.create({
        data: {
          name: dto.name,
          description: dto.description,
          personality: dto.personality,
          avatarUrl: dto.avatarUrl,
          sortOrder: dto.sortOrder || 0,
          isActive: true
        }
      });

      this.logger.log(`AI 캐릭터 생성 완료: ID ${character.id}, 이름 ${character.name}`);
      return this.formatCharacterResponse(character);
    } catch (error) {
      this.logger.error(`AI 캐릭터 생성 실패: ${error.message}`);
      throw new BadRequestException('캐릭터 생성 중 오류가 발생했습니다');
    }
  }

  /**
   * 모든 AI 캐릭터 조회 (활성화된 캐릭터만)
   * 정렬 순서대로 반환
   */
  async getAllCharacters(): Promise<AiCharacterListResponseDto> {
    this.logger.log('활성화된 AI 캐릭터 전체 조회');

    const characters = await this.prisma.aiCharacter.findMany({
      where: { isActive: true },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return {
      characters: characters.map(char => this.formatCharacterResponse(char)),
      total: characters.length
    };
  }

  /**
   * 관리자용 - 모든 AI 캐릭터 조회 (비활성화 포함)
   */
  async getAllCharactersForAdmin(): Promise<AiCharacterListResponseDto> {
    this.logger.log('관리자용 AI 캐릭터 전체 조회 (비활성화 포함)');

    const characters = await this.prisma.aiCharacter.findMany({
      orderBy: [
        { isActive: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return {
      characters: characters.map(char => this.formatCharacterResponse(char)),
      total: characters.length
    };
  }

  /**
   * AI 캐릭터 단일 조회
   */
  async getCharacterById(id: number): Promise<AiCharacterResponseDto> {
    this.logger.log(`AI 캐릭터 조회: ID ${id}`);

    const character = await this.prisma.aiCharacter.findUnique({
      where: { id }
    });

    if (!character) {
      throw new NotFoundException(`ID ${id}에 해당하는 캐릭터를 찾을 수 없습니다`);
    }

    return this.formatCharacterResponse(character);
  }

  /**
   * AI 캐릭터 수정
   */
  async updateCharacter(id: number, dto: UpdateAiCharacterDto): Promise<AiCharacterResponseDto> {
    this.logger.log(`AI 캐릭터 수정 시도: ID ${id}`);

    // 캐릭터 존재 여부 확인
    const existingCharacter = await this.prisma.aiCharacter.findUnique({
      where: { id }
    });

    if (!existingCharacter) {
      throw new NotFoundException(`ID ${id}에 해당하는 캐릭터를 찾을 수 없습니다`);
    }

    // 이름이 변경되는 경우 중복 확인
    if (dto.name && dto.name !== existingCharacter.name) {
      const duplicateCharacter = await this.prisma.aiCharacter.findFirst({
        where: {
          name: dto.name,
          id: { not: id }
        }
      });

      if (duplicateCharacter) {
        throw new ConflictException(`이미 '${dto.name}' 이름의 캐릭터가 존재합니다`);
      }
    }

    try {
      const updatedCharacter = await this.prisma.aiCharacter.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.personality !== undefined && { personality: dto.personality }),
          ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder })
        }
      });

      this.logger.log(`AI 캐릭터 수정 완료: ID ${id}, 이름 ${updatedCharacter.name}`);
      return this.formatCharacterResponse(updatedCharacter);
    } catch (error) {
      this.logger.error(`AI 캐릭터 수정 실패: ${error.message}`);
      throw new BadRequestException('캐릭터 수정 중 오류가 발생했습니다');
    }
  }

  /**
   * AI 캐릭터 삭제 (소프트 삭제 - isActive를 false로 변경)
   */
  async deleteCharacter(id: number): Promise<{ success: boolean; message: string }> {
    this.logger.log(`AI 캐릭터 삭제 시도: ID ${id}`);

    const existingCharacter = await this.prisma.aiCharacter.findUnique({
      where: { id }
    });

    if (!existingCharacter) {
      throw new NotFoundException(`ID ${id}에 해당하는 캐릭터를 찾을 수 없습니다`);
    }

    // 해당 캐릭터를 사용하는 사용자가 있는지 확인
    const usersUsingCharacter = await this.prisma.user.count({
      where: { characterId: id }
    });

    if (usersUsingCharacter > 0) {
      throw new BadRequestException(`${usersUsingCharacter}명의 사용자가 이 캐릭터를 사용 중입니다. 삭제할 수 없습니다.`);
    }

    // 해당 캐릭터를 사용하는 밸런스게임 단계가 있는지 확인
    const balanceGameStepsCount = await this.prisma.balanceGameStep.count({
      where: { characterId: id }
    });

    if (balanceGameStepsCount > 0) {
      throw new BadRequestException(`${balanceGameStepsCount}개의 밸런스게임에서 이 캐릭터를 사용 중입니다. 삭제할 수 없습니다.`);
    }

    try {
      await this.prisma.aiCharacter.update({
        where: { id },
        data: { isActive: false }
      });

      this.logger.log(`AI 캐릭터 삭제 완료: ID ${id}, 이름 ${existingCharacter.name}`);
      return {
        success: true,
        message: `캐릭터 '${existingCharacter.name}'이 성공적으로 삭제되었습니다`
      };
    } catch (error) {
      this.logger.error(`AI 캐릭터 삭제 실패: ${error.message}`);
      throw new BadRequestException('캐릭터 삭제 중 오류가 발생했습니다');
    }
  }

  /**
   * AI 캐릭터 응답 포맷팅
   */
  private formatCharacterResponse(character: any): AiCharacterResponseDto {
    return {
      id: character.id,
      name: character.name,
      description: character.description,
      personality: character.personality,
      avatarUrl: character.avatarUrl,
      isActive: character.isActive,
      sortOrder: character.sortOrder,
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt?.toISOString()
    };
  }
}