import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateAddressDto,
  UpdateAddressDto,
  AddressResponseDto,
} from './dto/address.dto';
import {
  UpdateRefundAccountDto,
  RefundAccountResponseDto,
} from './dto/refund-account.dto';
import { ProfileImageResponseDto } from './dto/profile-image.dto';
import { WithdrawResponseDto } from './dto/withdraw.dto';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 마이페이지 서비스
 * - 배송 주소 관리 (CRUD + 기본 주소 설정)
 * - 환불 계좌 관리 (조회/수정/삭제)
 * - 프로필 이미지 관리 (조회/설정/삭제)
 */
@Injectable()
export class MypageService {
  private static readonly MAX_ADDRESSES = 10;
  private readonly logger = new Logger(MypageService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // 배송 주소 관리
  // ============================================

  /**
   * 사용자의 배송 주소 목록 조회
   */
  async getAddresses(userId: number): Promise<AddressResponseDto[]> {
    const addresses = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return addresses.map((addr) => this.toAddressResponse(addr));
  }

  /**
   * 특정 배송 주소 조회
   */
  async getAddress(userId: number, addressId: number): Promise<AddressResponseDto> {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('주소를 찾을 수 없습니다');
    }

    return this.toAddressResponse(address);
  }

  /**
   * 배송 주소 생성
   * - 최대 10개까지 등록 가능
   * - 첫 번째 주소는 자동으로 기본 주소로 설정
   */
  async createAddress(
    userId: number,
    dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    // 현재 주소 개수 확인
    const count = await this.prisma.userAddress.count({ where: { userId } });
    if (count >= MypageService.MAX_ADDRESSES) {
      throw new BadRequestException(
        `배송 주소는 최대 ${MypageService.MAX_ADDRESSES}개까지 등록할 수 있습니다`,
      );
    }

    // 첫 번째 주소이거나 기본 주소로 설정 요청 시
    const shouldBeDefault = count === 0 || dto.isDefault === true;

    // 기본 주소로 설정 시 기존 기본 주소 해제
    if (shouldBeDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const now = getNowKST();
    const address = await this.prisma.userAddress.create({
      data: {
        userId,
        alias: dto.alias,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        postalCode: dto.postalCode,
        address: dto.address,
        addressDetail: dto.addressDetail,
        isDefault: shouldBeDefault,
        createdAt: now,
        updatedAt: now,
      },
    });

    return this.toAddressResponse(address);
  }

  /**
   * 배송 주소 수정
   */
  async updateAddress(
    userId: number,
    addressId: number,
    dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    // 주소 존재 여부 확인
    const existing = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw new NotFoundException('주소를 찾을 수 없습니다');
    }

    // 기본 주소로 설정 시 기존 기본 주소 해제
    if (dto.isDefault === true && !existing.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.userAddress.update({
      where: { id: addressId },
      data: {
        alias: dto.alias,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        postalCode: dto.postalCode,
        address: dto.address,
        addressDetail: dto.addressDetail,
        isDefault: dto.isDefault,
      },
    });

    return this.toAddressResponse(address);
  }

  /**
   * 배송 주소 삭제
   * - 기본 주소 삭제 시 가장 최근 주소가 기본 주소가 됨
   */
  async deleteAddress(userId: number, addressId: number): Promise<void> {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('주소를 찾을 수 없습니다');
    }

    await this.prisma.userAddress.delete({ where: { id: addressId } });

    // 기본 주소였다면 다른 주소를 기본으로 설정
    if (address.isDefault) {
      const latestAddress = await this.prisma.userAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (latestAddress) {
        await this.prisma.userAddress.update({
          where: { id: latestAddress.id },
          data: { isDefault: true },
        });
      }
    }
  }

  /**
   * 기본 주소 설정
   */
  async setDefaultAddress(userId: number, addressId: number): Promise<AddressResponseDto> {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('주소를 찾을 수 없습니다');
    }

    // 기존 기본 주소 해제
    await this.prisma.userAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    // 새 기본 주소 설정
    const updated = await this.prisma.userAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    return this.toAddressResponse(updated);
  }

  // ============================================
  // 환불 계좌 관리
  // ============================================

  /**
   * 환불 계좌 조회
   */
  async getRefundAccount(userId: number): Promise<RefundAccountResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        refundBankCode: true,
        refundBankName: true,
        refundAccountNo: true,
        refundHolder: true,
      },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    return {
      refundBankCode: user.refundBankCode,
      refundBankName: user.refundBankName,
      refundAccountNo: user.refundAccountNo,
      refundHolder: user.refundHolder,
    };
  }

  /**
   * 환불 계좌 수정
   */
  async updateRefundAccount(
    userId: number,
    dto: UpdateRefundAccountDto,
  ): Promise<RefundAccountResponseDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        refundBankCode: dto.refundBankCode,
        refundBankName: dto.refundBankName,
        refundAccountNo: dto.refundAccountNo,
        refundHolder: dto.refundHolder,
      },
      select: {
        refundBankCode: true,
        refundBankName: true,
        refundAccountNo: true,
        refundHolder: true,
      },
    });

    return {
      refundBankCode: user.refundBankCode,
      refundBankName: user.refundBankName,
      refundAccountNo: user.refundAccountNo,
      refundHolder: user.refundHolder,
    };
  }

  /**
   * 환불 계좌 삭제
   */
  async deleteRefundAccount(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refundBankCode: null,
        refundBankName: null,
        refundAccountNo: null,
        refundHolder: null,
      },
    });
  }

  // ============================================
  // 프로필 이미지 관리
  // ============================================

  /**
   * 프로필 이미지 조회
   */
  async getProfileImage(userId: number): Promise<ProfileImageResponseDto> {
    const profileImage = await this.prisma.userFile.findFirst({
      where: { userId, fileType: 'PROFILE' },
      include: { file: true },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!profileImage) {
      return {
        id: null,
        fileId: null,
        filePath: null,
        originalName: null,
        uploadedAt: null,
      };
    }

    return {
      id: profileImage.id,
      fileId: profileImage.fileId,
      filePath: profileImage.file.filePath,
      originalName: profileImage.file.originalName,
      uploadedAt: profileImage.uploadedAt,
    };
  }

  /**
   * 프로필 이미지 설정
   * - 기존 프로필 이미지가 있으면 삭제 후 새로 설정
   */
  async setProfileImage(userId: number, fileId: number): Promise<ProfileImageResponseDto> {
    // 파일 존재 여부 확인
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('파일을 찾을 수 없습니다');
    }

    // 기존 프로필 이미지 삭제
    await this.prisma.userFile.deleteMany({
      where: { userId, fileType: 'PROFILE' },
    });

    // 새 프로필 이미지 생성
    const profileImage = await this.prisma.userFile.create({
      data: {
        userId,
        fileId,
        fileType: 'PROFILE',
        uploadCategory: 'PROFILE',
      },
      include: { file: true },
    });

    return {
      id: profileImage.id,
      fileId: profileImage.fileId,
      filePath: profileImage.file.filePath,
      originalName: profileImage.file.originalName,
      uploadedAt: profileImage.uploadedAt,
    };
  }

  /**
   * 프로필 이미지 삭제
   */
  async deleteProfileImage(userId: number): Promise<void> {
    await this.prisma.userFile.deleteMany({
      where: { userId, fileType: 'PROFILE' },
    });
  }

  // ============================================
  // 회원탈퇴
  // ============================================

  /**
   * 회원탈퇴 처리
   * 1. 탈퇴 회원 정보를 withdrawn_users 테이블에 이관
   * 2. users 테이블의 개인정보 마스킹 처리
   * 3. is_active = false, deleted_at 설정
   *
   * @param userId 사용자 ID
   * @param reason 탈퇴 사유 (선택)
   * @returns 탈퇴 처리 결과
   */
  async withdraw(userId: number, reason?: string): Promise<WithdrawResponseDto> {
    this.logger.log(`회원탈퇴 요청: userId=${userId}`);

    // 1. 사용자 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        mobile: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    if (!user.isActive || user.deletedAt) {
      throw new BadRequestException('이미 탈퇴한 회원입니다');
    }

    const now = getNowKST();

    // 2. 트랜잭션으로 탈퇴 처리
    await this.prisma.$transaction(async (tx) => {
      // 2-1. withdrawn_users 테이블에 정보 이관
      await tx.withdrawnUser.create({
        data: {
          userId: user.id,
          name: user.name,
          mobile: user.mobile,
          reason: reason || null,
          withdrawnAt: now,
          createdAt: now,
        },
      });

      // 2-2. users 테이블 개인정보 삭제 및 비활성화
      await tx.user.update({
        where: { id: userId },
        data: {
          // 개인정보 삭제 (NOT NULL 컬럼은 빈 문자열)
          name: '',
          mobile: '',
          email: null,
          password: null,
          birthDate: null,
          telecom: null,
          sex: null,
          localCode: null,
          // 계정 비활성화
          isActive: false,
          deletedAt: now,
          // 환불계좌 등 민감정보 삭제
          refundAccountNo: null,
          refundBankCode: null,
          refundBankName: null,
          refundHolder: null,
        },
      });

      // 2-3. Refresh Token 삭제 (로그아웃 처리)
      await tx.refreshToken.deleteMany({
        where: { userId },
      });

      // 2-4. Push Token 삭제
      await tx.pushToken.deleteMany({
        where: { userId },
      });

      // 2-5. 배송 주소 삭제
      await tx.userAddress.deleteMany({
        where: { userId },
      });

      // 2-6. 사용자 파일 삭제
      await tx.userFile.deleteMany({
        where: { userId },
      });

      // 2-7. AI 채팅 이력 삭제
      await tx.userChatHistory.deleteMany({
        where: { userId },
      });

      // 2-8. AI 채팅 일별 요약 삭제
      await tx.userChatDailySummary.deleteMany({
        where: { userId },
      });

      // 2-9. AI 심층 리포트 삭제
      await tx.userDeepReport.deleteMany({
        where: { userId },
      });
    });

    this.logger.log(`회원탈퇴 완료: userId=${userId}`);

    return {
      success: true,
      message: '회원탈퇴가 완료되었습니다.',
    };
  }

  // ============================================
  // Private Methods
  // ============================================

  private toAddressResponse(address: {
    id: number;
    alias: string | null;
    recipientName: string;
    recipientPhone: string;
    postalCode: string;
    address: string;
    addressDetail: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AddressResponseDto {
    return {
      id: address.id,
      alias: address.alias,
      recipientName: address.recipientName,
      recipientPhone: address.recipientPhone,
      postalCode: address.postalCode,
      address: address.address,
      addressDetail: address.addressDetail,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
