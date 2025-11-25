import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import * as bcrypt from 'bcrypt';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * 백오피스 사용자 관리 서비스
 */
@Injectable()
export class ManagementUsersService {
  private readonly logger = new Logger(ManagementUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자 목록 조회
   */
  async findAll(
    offset: number = 0,
    limit: number = 10,
    search?: string,
    sort: string = 'createdAt:desc',
  ) {
    limit = Math.min(limit, 100);

    const [sortField, sortOrder] = sort.split(':');
    const orderBy = {
      [sortField]: sortOrder === 'asc' ? 'asc' : 'desc',
    };

    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { mobile: { contains: search } },
      ],
    } : {};

    const total = await this.prisma.user.count({ where });

    const users = await this.prisma.user.findMany({
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
  }

  /**
   * 사용자 상세 조회
   */
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
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
  }

  /**
   * 사용자 생성
   */
  async create(createUserDto: {
    email: string;
    password: string;
    name: string;
    mobile?: string;
  }) {
    const { email, password, name, mobile } = createUserDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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

    return user;
  }

  /**
   * 사용자 정보 수정
   */
  async update(id: number, updateUserDto: {
    email?: string;
    password?: string;
    name?: string;
    mobile?: string;
    aiPersonaId?: number;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`ID ${id}인 사용자를 찾을 수 없습니다.`);
    }

    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (emailExists) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }
    }

    const updateData: any = { ...updateUserDto };
    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
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

    return user;
  }

  /**
   * 사용자 삭제
   */
  async remove(id: number) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`ID ${id}인 사용자를 찾을 수 없습니다.`);
    }

    await this.prisma.$transaction(async (prisma) => {
      await prisma.userFile.deleteMany({
        where: { userId: id },
      });

      await prisma.user.delete({
        where: { id },
      });
    });
  }
}
