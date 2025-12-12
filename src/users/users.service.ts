import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 사용자 서비스
 * Prisma를 사용한 사용자 관리 비즈니스 로직
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자 목록 조회 (V2 방식)
   * offset/limit 기반 페이지네이션, 필터링, 정렬 지원
   */
  async findAll(
    offset: number = 0,
    limit: number = 10,
    search?: string,
    sort: string = 'createdAt:desc',
    include?: string[]
  ) {
    // 최대 limit 제한
    limit = Math.min(limit, 100);
    
    // 정렬 파싱
    const [sortField, sortOrder] = sort.split(':');
    const orderBy = {
      [sortField]: sortOrder === 'asc' ? 'asc' : 'desc',
    };

    // 검색 조건
    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { mobile: { contains: search } },
      ],
    } : {};

    this.logger.log(`사용자 목록 조회 - offset: ${offset}, limit: ${limit}, search: ${search || 'none'}, sort: ${sort}`);

    try {
      // 전체 개수 조회
      const total = await this.prisma.user.count({ where });

      // include 옵션에 따라 쿼리 분기
      const includeUserFiles = include?.includes('userFiles');

      // 사용자 목록 조회
      const users = includeUserFiles
        ? await this.prisma.user.findMany({
            where,
            include: {
              userFiles: {
                select: {
                  id: true,
                  fileId: true,
                  uploadedAt: true,
                  fileType: true,
                  uploadCategory: true,
                  file: {
                    select: {
                      originalName: true,
                      storedName: true,
                      filePath: true,
                      fileSize: true,
                      mimeType: true,
                    },
                  },
                },
              },
            },
            orderBy,
            skip: offset,
            take: limit,
          })
        : await this.prisma.user.findMany({
            where,
            select: {
              id: true,
              email: true,
              name: true,
              mobile: true,
              points: true,
              aiPersonaId: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy,
            skip: offset,
            take: limit,
          });

      return {
        items: users,
        pagination: {
          offset,
          limit,
          total,
          hasNext: offset + limit < total,
          hasPrev: offset > 0,
        },
        filters: {
          search: search || null,
        },
        sort,
      };
    } catch (error) {
      this.logger.error(`사용자 목록 조회 실패: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 사용자 상세 조회 (V2 방식)
   * 관련 리소스 포함 옵션 지원
   */
  async findOne(id: number, include?: string[]) {
    this.logger.log(`사용자 조회 - ID: ${id}, include: ${include?.join(',') || 'none'}`);

    try {
      // include 옵션에 따라 쿼리 분기
      const includeUserFiles = include?.includes('userFiles');

      const user = includeUserFiles
        ? await this.prisma.user.findUnique({
            where: { id },
            include: {
              userFiles: {
                select: {
                  id: true,
                  fileId: true,
                  uploadedAt: true,
                  fileType: true,
                  uploadCategory: true,
                  file: {
                    select: {
                      originalName: true,
                      storedName: true,
                      filePath: true,
                      fileSize: true,
                      mimeType: true,
                    },
                  },
                },
              },
            },
          })
        : await this.prisma.user.findUnique({
            where: { id },
            select: {
              id: true,
              // email: true,
              name: true,
              mobile: true,
              points: true,
              aiPersonaId: true,
              createdAt: true,
              updatedAt: true,
            },
          });

      if (!user) {
        throw new NotFoundException(`ID ${id}인 사용자를 찾을 수 없습니다.`);
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`사용자 조회 실패 - ID: ${id}, ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 사용자 생성 (V2 방식)
   * 향상된 유효성 검사 및 중복 확인
   */
  async create(createUserDto: CreateUserDto) {
    const { email, password, name, mobile } = createUserDto;
    
    this.logger.log(`사용자 생성 시도 - 이메일: ${email}`);

    try {
      // 이메일 중복 확인
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }

      // 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(password, 10);

      // 사용자 생성
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          mobile,
          createdAt: getNowKST(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          mobile: true,
          points: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(`사용자 생성 성공 - ID: ${user.id}, 이메일: ${user.email}`);
      return user;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`사용자 생성 실패 - 이메일: ${email}, ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 사용자 정보 수정 (V2 방식)
   * 부분 업데이트 지원
   */
  async update(id: number, updateUserDto: UpdateUserDto) {
    this.logger.log(`사용자 수정 시도 - ID: ${id}`);

    try {
      // 사용자 존재 확인
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new NotFoundException(`ID ${id}인 사용자를 찾을 수 없습니다.`);
      }

      // 사용자 정보 수정 (이름, 휴대폰 번호만)
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          name: updateUserDto.name,
          mobile: updateUserDto.mobile,
        },
        select: {
          id: true,
          email: true,
          name: true,
          mobile: true,
          points: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(`사용자 수정 성공 - ID: ${user.id}`);
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`사용자 수정 실패 - ID: ${id}, ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 사용자 삭제 (V2 방식)
   * 관련 데이터 정리
   */
  async remove(id: number) {
    this.logger.log(`사용자 삭제 시도 - ID: ${id}`);

    try {
      // 사용자 존재 확인
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new NotFoundException(`ID ${id}인 사용자를 찾을 수 없습니다.`);
      }

      // 트랜잭션으로 관련 데이터와 함께 삭제
      await this.prisma.$transaction(async (prisma) => {
        // 관련 사용자 파일 데이터 먼저 삭제
        await prisma.userFile.deleteMany({
          where: { userId: id },
        });

        // 사용자 삭제
        await prisma.user.delete({
          where: { id },
        });
      });

      this.logger.log(`사용자 삭제 성공 - ID: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`사용자 삭제 실패 - ID: ${id}, ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 이메일로 사용자 조회 (인증용)
   */
  async findByEmail(email: string) {
    this.logger.log(`이메일로 사용자 조회 - 이메일: ${email}`);

    try {
      return await this.prisma.user.findUnique({
        where: { email },
      });
    } catch (error) {
      this.logger.error(`이메일 조회 실패 - 이메일: ${email}, ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * AI 페르소나 업데이트 전용 메서드
   * 사용자의 AI 페르소나 식별자만 안전하게 업데이트
   */
  async updatePersona(userId: number, aiPersonaId: number) {
    this.logger.log(`사용자 ${userId}의 페르소나 업데이트 시도 - 페르소나 ID: ${aiPersonaId}`);

    try {
      // 사용자 존재 확인
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        throw new NotFoundException(`ID ${userId}인 사용자를 찾을 수 없습니다.`);
      }

      // AI 페르소나 유효성 확인
      const persona = await this.prisma.aiPersona.findUnique({
        where: { id: aiPersonaId },
      });

      if (!persona) {
        throw new NotFoundException(`ID ${aiPersonaId}인 페르소나를 찾을 수 없습니다.`);
      }

      if (!persona.isActive) {
        throw new ConflictException('비활성화된 페르소나는 선택할 수 없습니다.');
      }

      this.logger.log(`페르소나 변경 - 사용자: ${userId}, 기존: ${existingUser.aiPersonaId}, 새로운: ${aiPersonaId}`);

      // 페르소나 업데이트
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { aiPersonaId },
        select: {
          id: true,
          // email: true,
          name: true,
          mobile: true,
          points: true,
          aiPersonaId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(`페르소나 업데이트 성공 - 사용자 ID: ${userId}, 페르소나 ID: ${aiPersonaId}`);
      return user;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`페르소나 업데이트 실패 - 사용자 ID: ${userId}, ${error.message}`, error.stack);
      throw error;
    }
  }
}