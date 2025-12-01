import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateOperatorDto } from './dto/create-operator.dto';
import { UpdateOperatorDto } from './dto/update-operator.dto';
import * as bcrypt from 'bcrypt';
import { getNowKST } from '../common/utils/kst-date.util';

@Injectable()
export class OperatorsService {
  private readonly logger = new Logger(OperatorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 운영자 생성
   */
  async create(dto: CreateOperatorDto) {
    this.logger.log(`운영자 생성 시도: ${dto.email}`);

    // 이메일 중복 체크
    const existing = await this.prisma.operator.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 운영자 생성
    const operator = await this.prisma.operator.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        accessTier: dto.accessTier || 'VIEWER',
        departmentId: dto.departmentId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        accessTier: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    this.logger.log(`운영자 생성 완료: ${operator.email} (ID: ${operator.id})`);

    return operator;
  }

  /**
   * 운영자 목록 조회
   */
  async findAll() {
    return this.prisma.operator.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        accessTier: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 운영자 상세 조회
   */
  async findOne(id: number) {
    const operator = await this.prisma.operator.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        accessTier: true,
        departmentId: true,
        isActive: true,
        failedAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            menuCodes: true,
          },
        },
      },
    });

    if (!operator) {
      throw new NotFoundException('운영자를 찾을 수 없습니다.');
    }

    return operator;
  }

  /**
   * 운영자 수정
   */
  async update(id: number, dto: UpdateOperatorDto) {
    this.logger.log(`운영자 수정 시도: ID ${id}`);

    // 존재 여부 확인
    const existing = await this.prisma.operator.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('운영자를 찾을 수 없습니다.');
    }

    // 업데이트 데이터 구성
    const updateData: any = {
      updatedAt: getNowKST(),
    };

    if (dto.name) updateData.name = dto.name;
    if (dto.accessTier) updateData.accessTier = dto.accessTier;
    if (dto.departmentId !== undefined) updateData.departmentId = dto.departmentId;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // 비밀번호 변경
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    const operator = await this.prisma.operator.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        accessTier: true,
        departmentId: true,
        isActive: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    this.logger.log(`운영자 수정 완료: ID ${id}`);

    return operator;
  }

  /**
   * 운영자 비활성화 (soft delete)
   */
  async deactivate(id: number) {
    this.logger.log(`운영자 비활성화 시도: ID ${id}`);

    const existing = await this.prisma.operator.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('운영자를 찾을 수 없습니다.');
    }

    await this.prisma.operator.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: getNowKST(),
      },
    });

    // 해당 운영자의 refresh token 삭제
    await this.prisma.operatorRefreshToken.deleteMany({
      where: { operatorId: id },
    });

    this.logger.log(`운영자 비활성화 완료: ID ${id}`);

    return { message: '운영자가 비활성화되었습니다.' };
  }

  /**
   * 계정 잠금 해제
   */
  async unlock(id: number) {
    this.logger.log(`운영자 잠금 해제 시도: ID ${id}`);

    const existing = await this.prisma.operator.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('운영자를 찾을 수 없습니다.');
    }

    await this.prisma.operator.update({
      where: { id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: getNowKST(),
      },
    });

    this.logger.log(`운영자 잠금 해제 완료: ID ${id}`);

    return { message: '계정 잠금이 해제되었습니다.' };
  }
}
