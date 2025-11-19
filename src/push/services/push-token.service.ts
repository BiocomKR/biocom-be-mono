import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { RegisterPushTokenDto } from '../dto/register-push-token.dto';
import { PushTokenResponseDto } from '../dto/push-token-response.dto';

/**
 * 푸시 토큰 관리 서비스
 *
 * 유저별 FCM 토큰 등록/조회/삭제 비즈니스 로직
 */
@Injectable()
export class PushTokenService {
  private readonly logger = new Logger(PushTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 푸시 토큰 등록 또는 업데이트
   *
   * 동일한 userId + deviceId + provider 조합이 존재하면 업데이트
   * 존재하지 않으면 새로 등록
   *
   * @param userId - 유저 ID
   * @param dto - 토큰 등록 정보
   * @returns 등록된 토큰 정보
   */
  async registerToken(
    userId: number,
    dto: RegisterPushTokenDto,
  ): Promise<PushTokenResponseDto> {
    const { token, deviceId, platform } = dto;

    this.logger.log(
      `📝 [PushTokenService] 푸시 토큰 등록 시도: userId=${userId}, deviceId=${deviceId || 'auto'}, platform=${platform}`,
    );

    try {
      // upsert: userId + deviceId + provider 조합으로 중복 체크
      this.logger.debug(
        `🔍 [PushTokenService] DB upsert 시작 (userId=${userId}, deviceId=${deviceId || token.substring(0, 10)}...)`,
      );

      const pushToken = await this.prisma.pushToken.upsert({
        where: {
          userId_deviceId_provider: {
            userId,
            deviceId: deviceId || token, // deviceId 없으면 token으로 구분
            provider: 'FCM',
          },
        },
        update: {
          token, // 토큰 업데이트
          platform,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          provider: 'FCM',
          token,
          deviceId: deviceId || token,
          platform,
          isActive: true,
        },
      });

      this.logger.log(
        `✅ [PushTokenService] 푸시 토큰 등록 성공: tokenId=${pushToken.id}, isActive=${pushToken.isActive}`,
      );

      return this.mapToResponseDto(pushToken);
    } catch (error) {
      this.logger.error(
        `❌ [PushTokenService] 푸시 토큰 등록 실패: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 유저의 모든 활성 토큰 조회
   *
   * @param userId - 유저 ID
   * @returns 활성화된 토큰 목록
   */
  async getUserTokens(userId: number): Promise<PushTokenResponseDto[]> {
    this.logger.log(`유저 토큰 조회: userId=${userId}`);

    const tokens = await this.prisma.pushToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    this.logger.log(`✅ 토큰 조회 완료: ${tokens.length}개`);

    return tokens.map((token) => this.mapToResponseDto(token));
  }

  /**
   * 특정 디바이스 토큰 비활성화
   *
   * @param userId - 유저 ID
   * @param deviceId - 디바이스 ID
   */
  async deleteToken(userId: number, deviceId: string): Promise<void> {
    this.logger.log(
      `🗑️ [PushTokenService] 토큰 비활성화 시작: userId=${userId}, deviceId=${deviceId}`,
    );

    const result = await this.prisma.pushToken.updateMany({
      where: {
        userId,
        deviceId,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `✅ [PushTokenService] 토큰 비활성화 완료: ${result.count}개 업데이트됨`,
    );
  }

  /**
   * 유저의 모든 토큰 비활성화
   *
   * @param userId - 유저 ID
   */
  async deleteAllUserTokens(userId: number): Promise<void> {
    this.logger.log(`유저의 모든 토큰 비활성화: userId=${userId}`);

    await this.prisma.pushToken.updateMany({
      where: {
        userId,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`✅ 유저 모든 토큰 비활성화 완료`);
  }

  /**
   * PushToken 엔티티를 ResponseDto로 변환
   *
   * @param token - Prisma PushToken 엔티티
   * @returns PushTokenResponseDto
   */
  private mapToResponseDto(token: any): PushTokenResponseDto {
    return {
      id: token.id,
      userId: token.userId,
      provider: token.provider,
      deviceId: token.deviceId,
      platform: token.platform,
      isActive: token.isActive,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }
}
