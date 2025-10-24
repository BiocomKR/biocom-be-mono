import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';
import {
  CreateAiPersonaDto,
  UpdateAiPersonaDto,
  AiPersonaResponseDto,
  AiPersonaListResponseDto
} from './dto/ai-persona.dto';

@Injectable()
export class AiPersonaService {
  private readonly logger = new Logger(AiPersonaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * AI 페르소나 생성
   * 같은 이름의 페르소나가 존재하는지 확인 후 생성
   */
  async createPersona(dto: CreateAiPersonaDto): Promise<AiPersonaResponseDto> {
    this.logger.log(`AI 페르소나 생성 시도: ${dto.name}`);

    // 같은 이름의 페르소나가 이미 존재하는지 확인
    const existingPersona = await this.prisma.aiPersona.findFirst({
      where: { name: dto.name }
    });

    if (existingPersona) {
      throw new ConflictException(`이미 '${dto.name}' 이름의 페르소나가 존재합니다`);
    }

    try {
      const persona = await this.prisma.aiPersona.create({
        data: {
          name: dto.name,
          description: dto.description,
          personality: dto.personality,
          personaUrl: dto.personaUrl,
          sortOrder: dto.sortOrder || 0,
          isActive: true,
          createdAt: getNowKST()
        }
      });

      this.logger.log(`AI 페르소나 생성 완료: ID ${persona.id}, 이름 ${persona.name}`);
      return this.formatPersonaResponse(persona);
    } catch (error) {
      this.logger.error(`AI 페르소나 생성 실패: ${error.message}`);
      throw new BadRequestException('페르소나 생성 중 오류가 발생했습니다');
    }
  }

  /**
   * 모든 AI 페르소나 조회 (활성화된 페르소나만)
   * 정렬 순서대로 반환
   */
  async getAllPersonas(): Promise<AiPersonaListResponseDto> {
    this.logger.log('활성화된 AI 페르소나 전체 조회');

    const personas = await this.prisma.aiPersona.findMany({
      where: { isActive: true },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return {
      personas: personas.map(p => this.formatPersonaResponse(p)),
      total: personas.length
    };
  }

  /**
   * 관리자용 - 모든 AI 페르소나 조회 (비활성화 포함)
   */
  async getAllPersonasForAdmin(): Promise<AiPersonaListResponseDto> {
    this.logger.log('관리자용 AI 페르소나 전체 조회 (비활성화 포함)');

    const personas = await this.prisma.aiPersona.findMany({
      orderBy: [
        { isActive: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return {
      personas: personas.map(p => this.formatPersonaResponse(p)),
      total: personas.length
    };
  }

  /**
   * AI 페르소나 단일 조회
   */
  async getPersonaById(id: number): Promise<AiPersonaResponseDto> {
    this.logger.log(`AI 페르소나 조회: ID ${id}`);

    const persona = await this.prisma.aiPersona.findUnique({
      where: { id }
    });

    if (!persona) {
      throw new NotFoundException(`ID ${id}에 해당하는 페르소나를 찾을 수 없습니다`);
    }

    return this.formatPersonaResponse(persona);
  }

  /**
   * AI 페르소나 수정
   */
  async updatePersona(id: number, dto: UpdateAiPersonaDto): Promise<AiPersonaResponseDto> {
    this.logger.log(`AI 페르소나 수정 시도: ID ${id}`);

    // 페르소나 존재 여부 확인
    const existingPersona = await this.prisma.aiPersona.findUnique({
      where: { id }
    });

    if (!existingPersona) {
      throw new NotFoundException(`ID ${id}에 해당하는 페르소나를 찾을 수 없습니다`);
    }

    // 이름이 변경되는 경우 중복 확인
    if (dto.name && dto.name !== existingPersona.name) {
      const duplicatePersona = await this.prisma.aiPersona.findFirst({
        where: {
          name: dto.name,
          id: { not: id }
        }
      });

      if (duplicatePersona) {
        throw new ConflictException(`이미 '${dto.name}' 이름의 페르소나가 존재합니다`);
      }
    }

    try {
      const updatedPersona = await this.prisma.aiPersona.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.personality !== undefined && { personality: dto.personality }),
          ...(dto.personaUrl !== undefined && { personaUrl: dto.personaUrl }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder })
        }
      });

      this.logger.log(`AI 페르소나 수정 완료: ID ${id}, 이름 ${updatedPersona.name}`);
      return this.formatPersonaResponse(updatedPersona);
    } catch (error) {
      this.logger.error(`AI 페르소나 수정 실패: ${error.message}`);
      throw new BadRequestException('페르소나 수정 중 오류가 발생했습니다');
    }
  }

  /**
   * AI 페르소나 삭제 (소프트 삭제 - isActive를 false로 변경)
   */
  async deletePersona(id: number): Promise<{ success: boolean; message: string }> {
    this.logger.log(`AI 페르소나 삭제 시도: ID ${id}`);

    const existingPersona = await this.prisma.aiPersona.findUnique({
      where: { id }
    });

    if (!existingPersona) {
      throw new NotFoundException(`ID ${id}에 해당하는 페르소나를 찾을 수 없습니다`);
    }

    // 해당 페르소나를 사용하는 사용자가 있는지 확인
    const usersUsingPersona = await this.prisma.user.count({
      where: { characterId: id }
    });

    if (usersUsingPersona > 0) {
      throw new BadRequestException(`${usersUsingPersona}명의 사용자가 이 페르소나를 사용 중입니다. 삭제할 수 없습니다.`);
    }

    // 해당 페르소나를 사용하는 밸런스게임 단계가 있는지 확인
    const balanceGameStepsCount = await this.prisma.balanceGameStep.count({
      where: { characterId: id }
    });

    if (balanceGameStepsCount > 0) {
      throw new BadRequestException(`${balanceGameStepsCount}개의 밸런스게임에서 이 페르소나를 사용 중입니다. 삭제할 수 없습니다.`);
    }

    try {
      await this.prisma.aiPersona.update({
        where: { id },
        data: { isActive: false }
      });

      this.logger.log(`AI 페르소나 삭제 완료: ID ${id}, 이름 ${existingPersona.name}`);
      return {
        success: true,
        message: `페르소나 '${existingPersona.name}'이 성공적으로 삭제되었습니다`
      };
    } catch (error) {
      this.logger.error(`AI 페르소나 삭제 실패: ${error.message}`);
      throw new BadRequestException('페르소나 삭제 중 오류가 발생했습니다');
    }
  }

  /**
   * AI 페르소나 응답 포맷팅
   */
  private formatPersonaResponse(persona: any): AiPersonaResponseDto {
    return {
      id: persona.id,
      name: persona.name,
      description: persona.description,
      personality: persona.personality,
      personaUrl: persona.personaUrl,
      isActive: persona.isActive,
      sortOrder: persona.sortOrder,
      createdAt: persona.createdAt.toISOString(),
      updatedAt: persona.updatedAt?.toISOString()
    };
  }
}
