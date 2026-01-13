import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import * as bcrypt from 'bcrypt';
import { getNowKST } from '../common/utils/kst-date.util';
import { UserQueryDto } from './dto/user-query.dto';
import { OrderStatus, UserChallengeStatus, CouponStatus, SubscriptionStatus, UserSubscriptionStatus, ChallengeTicketStatus } from '../common/enums';
import { CryptoUtil } from '../common/utils/crypto.util';

/**
 * 백오피스 사용자 관리 서비스
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자 목록 조회 (확장)
   */
  async findAll(query: UserQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      isActive,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeDeleted = false,
      sex,
      ageGroup,
      hasBillingKey,
      excludeTesters = false,
    } = query;

    const offset = (page - 1) * limit;

    // WHERE 조건 구성
    const where: any = {};

    // 삭제된 회원 포함 여부
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    // 검색어 필터
    // 이름은 GCM 암호화되어 contains 검색 불가 → 별도 처리 필요
    // 전화번호는 결정론적 암호화로 정확한 매칭만 가능
    let nameSearchKeyword: string | null = null;
    if (search) {
      const isPhoneNumber = /^[0-9-]+$/.test(search);
      if (isPhoneNumber) {
        // 전화번호 검색: 정확한 매칭 (Prisma 미들웨어가 암호화 처리)
        const normalizedPhone = search.replace(/-/g, '');
        where.mobile = normalizedPhone;
      } else if (search.includes('@')) {
        // 이메일 검색
        where.email = { contains: search, mode: 'insensitive' };
      } else {
        // 이름 검색: 후처리 필터링 필요
        nameSearchKeyword = search;
      }
    }

    // 상태 필터 (NEWCOMER: User.status, CHALLENGER: 활성 챌린지 보유, SUBSCRIBER: 활성 구독 보유)
    if (status) {
      if (status === UserSubscriptionStatus.NEWCOMER) {
        where.status = UserSubscriptionStatus.NEWCOMER;
      } else if (status === UserSubscriptionStatus.CHALLENGER) {
        where.userChallenges = {
          some: {
            status: UserChallengeStatus.ACTIVE,
          },
        };
      } else if (status === UserSubscriptionStatus.SUBSCRIBER) {
        const subscriberIds = await this.prisma.subscription.findMany({
          where: { status: SubscriptionStatus.ACTIVE },
          select: { userId: true },
        });
        where.id = { in: subscriberIds.map((s) => s.userId) };
      }
    }

    // 활성화 여부 필터
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // 가입일 범위 필터
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // 성별 필터
    if (sex) {
      where.sex = sex;
    }

    // 연령대 필터 (birthDate는 VARCHAR(8) 형식: YYYYMMDD)
    if (ageGroup) {
      const now = getNowKST();
      const ageStart = parseInt(ageGroup);
      const ageEnd = ageStart === 60 ? 150 : ageStart + 9; // 60대+는 60세 이상 전부

      // 생년월일 범위 계산 (나이 기준)
      const birthDateEnd = new Date(now.getFullYear() - ageStart, now.getMonth(), now.getDate());
      const birthDateStart = new Date(now.getFullYear() - ageEnd - 1, now.getMonth(), now.getDate());

      // YYYYMMDD 문자열 형식으로 변환
      const formatDateString = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      where.birthDate = {
        gte: formatDateString(birthDateStart),
        lte: formatDateString(birthDateEnd),
      };
    }

    // 빌링키 등록 여부 필터
    if (hasBillingKey !== undefined) {
      if (hasBillingKey) {
        where.billingKey = { not: null };
      } else {
        where.billingKey = null;
      }
    }

    // 테스터 제외 필터
    if (excludeTesters) {
      where.isTester = false;
    }

    // 정렬 설정
    let orderBy: any;
    if (sortBy === 'orderCount') {
      orderBy = { orders: { _count: sortOrder } };
    } else if (sortBy === 'challengeCount') {
      orderBy = { userChallenges: { _count: sortOrder } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    // 이름 검색인 경우: 전체 조회 후 복호화 필터링 (GCM 암호화는 DB 검색 불가)
    if (nameSearchKeyword) {
      // 전체 사용자 조회 (필터 조건 적용, 이름 제외)
      const allUsers = await this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          mobile: true,
          points: true,
          status: true,
          role: true,
          isActive: true,
          birthDate: true,
          sex: true,
          telecom: true,
          billingKey: true,
          pushEnabled: true,
          health_type_animal_id: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          healthTypeAnimal: {
            select: {
              id: true,
              animalName: true,
              healthType: true,
              typeName: true,
            },
          },
          userRecords: {
            select: {
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              orders: true,
              userChallenges: true,
              userCoupons: true,
            },
          },
        },
        orderBy,
      });

      // 복호화 후 이름 필터링
      const filteredUsers = allUsers
        .map(user => ({
          ...user,
          decryptedName: CryptoUtil.decrypt(user.name),
        }))
        .filter(user => user.decryptedName?.includes(nameSearchKeyword));

      const total = filteredUsers.length;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);

      const userList = paginatedUsers.map(user => ({
        id: user.id,
        email: user.email,
        name: user.decryptedName,
        mobile: user.mobile,
        points: user.points,
        status: user.status,
        role: user.role,
        isActive: user.isActive,
        birthDate: user.birthDate,
        sex: user.sex,
        telecom: user.telecom,
        hasBillingKey: !!user.billingKey,
        pushEnabled: user.pushEnabled,
        healthTypeAnimalId: user.health_type_animal_id,
        healthTypeAnimalName: user.healthTypeAnimal?.animalName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        deletedAt: user.deletedAt,
        orderCount: user._count.orders,
        challengeCount: user._count.userChallenges,
        couponCount: user._count.userCoupons,
        lastRecordDate: user.userRecords[0]?.createdAt || null,
      }));

      return {
        users: userList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // 일반 검색 (이름 검색이 아닌 경우)
    const total = await this.prisma.user.count({ where });

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        points: true,
        status: true,
        role: true,
        isActive: true,
        birthDate: true,
        sex: true,
        telecom: true,
        billingKey: true,
        pushEnabled: true,
        health_type_animal_id: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        healthTypeAnimal: {
          select: {
            id: true,
            animalName: true,
            healthType: true,
            typeName: true,
          },
        },
        userRecords: {
          select: {
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            orders: true,
            userChallenges: true,
            userCoupons: true,
          },
        },
      },
      orderBy,
      skip: offset,
      take: limit,
    });

    // 응답 형식 변환 (Prisma Extension에서 자동 복호화됨)
    const userList = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      points: user.points,
      status: user.status,
      role: user.role,
      isActive: user.isActive,
      birthDate: user.birthDate,
      sex: user.sex,
      telecom: user.telecom,
      hasBillingKey: !!user.billingKey,
      pushEnabled: user.pushEnabled,
      healthTypeAnimalId: user.health_type_animal_id,
      healthTypeAnimalName: user.healthTypeAnimal?.animalName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      orderCount: user._count.orders,
      challengeCount: user._count.userChallenges,
      couponCount: user._count.userCoupons,
      lastRecordDate: user.userRecords[0]?.createdAt || null,
    }));

    return {
      users: userList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 사용자 상세 조회 (확장)
   */
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        points: true,
        status: true,
        role: true,
        isActive: true,
        isTester: true,
        birthDate: true,
        sex: true,
        telecom: true,
        localCode: true,
        billingKey: true,
        pushEnabled: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        aiPersona: {
          select: {
            id: true,
            name: true,
          },
        },
        healthTypeAnimal: {
          select: {
            id: true,
            animalName: true,
            healthType: true,
            typeName: true,
          },
        },
        pushTokens: {
          select: {
            id: true,
            token: true,
            platform: true,
            deviceModel: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        userChallenges: {
          select: {
            id: true,
            status: true,
            activatedAt: true,
            expiresAt: true,
            totalPoints: true,
            product: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        cart: {
          select: {
            id: true,
            items: {
              select: {
                id: true,
                quantity: true,
                addedAt: true,
                stockAvailable: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    productFiles: {
                      where: { imageType: 'MAIN' },
                      take: 1,
                      select: {
                        file: {
                          select: {
                            filePath: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
              orderBy: { addedAt: 'desc' },
            },
          },
        },
        _count: {
          select: {
            orders: true,
            userChallenges: true,
            userCoupons: true,
            pointHistories: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`ID ${id}인 사용자를 찾을 수 없습니다.`);
    }

    // 추가 통계 조회
    const [totalOrderAmount, activeChallengeCount, unusedCouponCount] = await Promise.all([
      this.prisma.order.aggregate({
        where: { userId: id, status: OrderStatus.COMPLETED },
        _sum: { totalAmount: true },
      }),
      this.prisma.userChallenge.count({
        where: { userId: id, status: UserChallengeStatus.ACTIVE },
      }),
      this.prisma.userCoupon.count({
        where: { userId: id, status: CouponStatus.ACTIVE, expiresAt: { gt: getNowKST() } },
      }),
    ]);

    // 장바구니 정보 가공
    const cartItems = (user.cart?.items || []).map(item => ({
      id: item.id,
      quantity: item.quantity,
      addedAt: item.addedAt,
      product: {
        id: item.product.id,
        name: item.product.name,
        price: Number(item.product.price),
        thumbnailUrl: item.product.productFiles?.[0]?.file?.filePath || null,
      },
      subtotal: Number(item.product.price) * item.quantity,
      stockAvailable: item.stockAvailable,
    }));

    const cartTotalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotalPrice = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      points: user.points,
      status: user.status,
      role: user.role,
      isActive: user.isActive,
      isTester: user.isTester,
      birthDate: user.birthDate,
      sex: user.sex,
      telecom: user.telecom,
      localCode: user.localCode,
      hasBillingKey: !!user.billingKey,
      pushEnabled: user.pushEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      aiPersona: user.aiPersona,
      healthTypeAnimal: user.healthTypeAnimal,
      pushTokens: user.pushTokens,
      stats: {
        orderCount: user._count.orders,
        totalOrderAmount: Number(totalOrderAmount._sum.totalAmount || 0),
        challengeCount: user._count.userChallenges,
        activeChallengeCount,
        couponCount: user._count.userCoupons,
        unusedCouponCount,
        pointHistoryCount: user._count.pointHistories,
        cartItemCount: cartItems.length,
      },
      recentOrders: user.orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt,
      })),
      userChallenges: user.userChallenges.map(uc => ({
        id: uc.id,
        productName: uc.product.name,
        status: uc.status,
        startDate: uc.activatedAt,
        endDate: uc.expiresAt,
        totalPoints: uc.totalPoints,
      })),
      cart: {
        items: cartItems,
        totalQuantity: cartTotalQuantity,
        totalPrice: cartTotalPrice,
      },
    };
  }

  /**
   * 사용자 통계 조회
   */
  async getStats(excludeTesters: boolean = false) {
    const now = getNowKST();
    const todayStart = new Date(now.getTime());
    todayStart.setUTCHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);

    // 테스터 제외 조건
    const testerCondition = excludeTesters ? { isTester: false } : {};

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      deletedUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      usersByStatus,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, ...testerCondition } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: true, ...testerCondition } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: false, ...testerCondition } }),
      this.prisma.user.count({ where: { deletedAt: { not: null }, ...testerCondition } }),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart }, ...testerCondition } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekStart }, ...testerCondition } }),
      this.prisma.user.count({ where: { createdAt: { gte: monthStart }, ...testerCondition } }),
      this.prisma.user.groupBy({
        by: ['status'],
        where: { deletedAt: null, ...testerCondition },
        _count: true,
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      deletedUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      usersByStatus: usersByStatus.map(item => ({
        status: item.status,
        count: item._count,
      })),
    };
  }

  /**
   * 사용자 생성
   */
  async create(createUserDto: {
    email: string;
    password: string;
    name: string;
    mobile: string;
  }) {
    const { email, password, name, mobile } = createUserDto;

    // 이메일 중복 체크
    if (email) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }
    }

    // 휴대폰 번호 중복 체크
    const existingMobile = await this.prisma.user.findFirst({
      where: { mobile },
    });

    if (existingMobile) {
      throw new ConflictException('이미 존재하는 휴대폰 번호입니다.');
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

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
        status: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * 사용자 정보 수정
   */
  async update(id: number, updateUserDto: {
    email?: string;
    name?: string;
    mobile?: string;
    status?: string;
    isActive?: boolean;
    points?: number;
    isTester?: boolean;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`ID ${id}인 사용자를 찾을 수 없습니다.`);
    }

    // 이메일 중복 체크
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: { email: updateUserDto.email, id: { not: id } },
      });

      if (emailExists) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }
    }

    // 휴대폰 번호 중복 체크
    if (updateUserDto.mobile && updateUserDto.mobile !== existingUser.mobile) {
      const mobileExists = await this.prisma.user.findFirst({
        where: { mobile: updateUserDto.mobile, id: { not: id } },
      });

      if (mobileExists) {
        throw new ConflictException('이미 존재하는 휴대폰 번호입니다.');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        points: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * 사용자 삭제 (소프트 삭제)
   */
  async remove(id: number) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`ID ${id}인 사용자를 찾을 수 없습니다.`);
    }

    // 소프트 삭제
    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: getNowKST(),
        isActive: false,
      },
    });
  }

  /**
   * 사용자 복구
   */
  async restore(id: number) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`ID ${id}인 사용자를 찾을 수 없습니다.`);
    }

    if (!existingUser.deletedAt) {
      throw new ConflictException('삭제되지 않은 사용자입니다.');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: true,
      },
    });

    return { message: '사용자가 복구되었습니다.' };
  }

  /**
   * 사용자 검색 (이름/전화번호)
   * - 전화번호: 결정론적 암호화로 정확히 매칭
   * - 이름: 모든 사용자를 가져와서 복호화 후 필터링 (GCM 암호화는 검색 불가)
   */
  async searchUsers(keyword: string, limit: number = 20, excludeTesters: boolean = false) {
    if (!keyword || keyword.trim().length < 1) {
      return [];
    }

    const searchKeyword = keyword.trim();
    const results: any[] = [];

    // 테스터 제외 조건
    const testerCondition = excludeTesters ? { isTester: false } : {};

    // 전화번호 형식인지 확인 (숫자만 있거나 010으로 시작하는 경우)
    const isPhoneNumber = /^[0-9-]+$/.test(searchKeyword);

    if (isPhoneNumber) {
      // 전화번호 검색: Prisma 미들웨어가 자동으로 암호화 처리
      // 평문 전화번호를 전달하면 미들웨어에서 암호화해서 검색
      const normalizedPhone = searchKeyword.replace(/-/g, '');

      const users = await this.prisma.user.findMany({
        where: {
          mobile: normalizedPhone,
          deletedAt: null,
          ...testerCondition,
        },
        select: {
          id: true,
          name: true,
          mobile: true,
          status: true,
          pushEnabled: true,
          _count: {
            select: {
              pushTokens: {
                where: { isActive: true },
              },
            },
          },
        },
        take: limit,
      });

      for (const user of users) {
        results.push({
          id: user.id,
          name: user.name,
          mobile: this.formatPhoneNumber(user.mobile),
          status: user.status,
          pushEnabled: user.pushEnabled,
          hasPushToken: user._count.pushTokens > 0,
        });
      }
    } else {
      // 이름 검색: 모든 활성 사용자를 가져와서 복호화 후 필터링
      // 성능을 위해 최근 가입 순으로 제한된 수만 조회
      const users = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          ...testerCondition,
        },
        select: {
          id: true,
          name: true,
          mobile: true,
          status: true,
          pushEnabled: true,
          _count: {
            select: {
              pushTokens: {
                where: { isActive: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000, // 최대 1000명까지만 검색
      });

      for (const user of users) {
        if (user.name && user.name.includes(searchKeyword)) {
          results.push({
            id: user.id,
            name: user.name,
            mobile: this.formatPhoneNumber(user.mobile),
            status: user.status,
            pushEnabled: user.pushEnabled,
            hasPushToken: user._count.pushTokens > 0,
          });

          if (results.length >= limit) break;
        }
      }
    }

    return results;
  }

  /**
   * 전화번호 포맷팅 (010-1234-5678)
   */
  private formatPhoneNumber(phone: string): string {
    if (!phone) return phone;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  }

  /**
   * NEWCOMER → CHALLENGER 챌린지 활성화
   * - 챌린지 티켓 생성
   * - UserChallenge 생성
   * - 유저 상태 변경
   */
  async activateChallenge(
    userId: number,
    data: { startDate: string; endDate: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`ID ${userId}인 사용자를 찾을 수 없습니다.`);
    }

    if (user.status !== UserSubscriptionStatus.NEWCOMER) {
      throw new BadRequestException('NEWCOMER 상태의 사용자만 챌린지를 활성화할 수 있습니다.');
    }

    // 기존 ACTIVE 챌린지 확인
    const existingActive = await this.prisma.userChallenge.findFirst({
      where: { userId, status: UserChallengeStatus.ACTIVE },
    });

    if (existingActive) {
      throw new BadRequestException('이미 활성화된 챌린지가 있습니다.');
    }

    // 이너뷰티 챌린지 상품 조회
    const product = await this.prisma.product.findFirst({
      where: {
        name: '이너뷰티 챌린지',
        categoryCode: 'CHALLENGE',
        status: 'ACTIVE',
      },
    });

    if (!product) {
      throw new NotFoundException('이너뷰티 챌린지 상품을 찾을 수 없습니다.');
    }

    // 날짜 파싱
    const activatedAt = new Date(data.startDate);
    activatedAt.setUTCHours(0, 0, 0, 0);
    const expiresAt = new Date(data.endDate);
    expiresAt.setUTCHours(23, 59, 59, 999);

    const now = getNowKST();

    // 종료일이 과거인지 확인 (만료된 챌린지)
    const isExpired = expiresAt < now;
    const challengeStatus = isExpired ? UserChallengeStatus.EXPIRED : UserChallengeStatus.ACTIVE;
    const userStatus = isExpired ? UserSubscriptionStatus.NEWCOMER : UserSubscriptionStatus.CHALLENGER;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 챌린지 티켓 생성
      const ticket = await tx.challengeTicket.create({
        data: {
          userId,
          productId: product.id,
          ticketType: 'QUICK_START',
          status: ChallengeTicketStatus.ACTIVATED,
          purchaseDate: now,
          createdAt: now,
        },
      });

      // 2. UserChallenge 생성
      const userChallenge = await tx.userChallenge.create({
        data: {
          userId,
          productId: product.id,
          ticketId: ticket.id,
          activatedAt,
          expiresAt,
          purchasedAt: now,
          status: challengeStatus,
          createdAt: now,
          isFirstEntry: !isExpired, // 만료된 챌린지는 첫 진입 아님
          isFirstChallengeEnd: isExpired, // 만료된 챌린지는 종료 후 첫 방문 플래그
          startDateSetAt: now,
        },
      });

      // 3. 유저 상태 업데이트
      await tx.user.update({
        where: { id: userId },
        data: { status: userStatus },
      });

      return { ticket, userChallenge };
    });

    this.logger.log(`챌린지 활성화 완료 - userId: ${userId}, challengeId: ${result.userChallenge.id}`);

    return {
      challengeId: result.userChallenge.id,
      ticketId: result.ticket.id,
      startDate: activatedAt,
      endDate: expiresAt,
    };
  }

  /**
   * 챌린지 일정 수정
   * - CHALLENGER: ACTIVE 챌린지 수정
   * - NEWCOMER: 직전 챌린지 (EXPIRED/COMPLETED) 수정 + 상태 재계산
   */
  async updateChallengeSchedule(
    userId: number,
    data: { startDate: string; endDate: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`ID ${userId}인 사용자를 찾을 수 없습니다.`);
    }

    // 날짜 파싱
    const activatedAt = new Date(data.startDate);
    activatedAt.setUTCHours(0, 0, 0, 0);
    const expiresAt = new Date(data.endDate);
    expiresAt.setUTCHours(23, 59, 59, 999);

    const now = getNowKST();

    // 종료일 기준 상태 결정
    const isExpired = expiresAt < now;
    const newChallengeStatus = isExpired ? UserChallengeStatus.EXPIRED : UserChallengeStatus.ACTIVE;
    const newUserStatus = isExpired ? UserSubscriptionStatus.NEWCOMER : UserSubscriptionStatus.CHALLENGER;

    // 챌린지 조회: ACTIVE 우선, 없으면 최근 EXPIRED/COMPLETED
    let challenge = await this.prisma.userChallenge.findFirst({
      where: { userId, status: UserChallengeStatus.ACTIVE },
    });

    if (!challenge) {
      // NEWCOMER인 경우 직전 챌린지 조회
      challenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: { in: [UserChallengeStatus.EXPIRED, UserChallengeStatus.COMPLETED] },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!challenge) {
      throw new BadRequestException('수정할 챌린지가 없습니다.');
    }

    // 트랜잭션으로 챌린지 + 유저 상태 동시 업데이트
    const [updated] = await this.prisma.$transaction([
      // 챌린지 일정 및 상태 업데이트
      this.prisma.userChallenge.update({
        where: { id: challenge.id },
        data: {
          activatedAt,
          expiresAt,
          status: newChallengeStatus,
          isFirstEntry: !isExpired, // 활성화되면 첫 진입 플래그 설정
          isFirstChallengeEnd: isExpired, // 만료되면 종료 후 첫 방문 플래그 설정
        },
      }),
      // 유저 상태 업데이트
      this.prisma.user.update({
        where: { id: userId },
        data: { status: newUserStatus },
      }),
    ]);

    this.logger.log(
      `챌린지 일정 수정 완료 - userId: ${userId}, challengeId: ${challenge.id}, ` +
      `challengeStatus: ${newChallengeStatus}, userStatus: ${newUserStatus}`,
    );

    return {
      challengeId: updated.id,
      startDate: activatedAt,
      endDate: expiresAt,
      challengeStatus: newChallengeStatus,
      userStatus: newUserStatus,
    };
  }

  /**
   * 사용자의 챌린지 조회
   * - ACTIVE 우선
   * - 없으면 최근 EXPIRED/COMPLETED (직전 챌린지)
   */
  async getActiveChallenge(userId: number) {
    // ACTIVE 챌린지 우선 조회
    let challenge = await this.prisma.userChallenge.findFirst({
      where: { userId, status: UserChallengeStatus.ACTIVE },
      include: {
        product: {
          select: { name: true },
        },
      },
    });

    // ACTIVE 없으면 직전 챌린지 (EXPIRED/COMPLETED) 조회
    if (!challenge) {
      challenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: { in: [UserChallengeStatus.EXPIRED, UserChallengeStatus.COMPLETED] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { name: true },
          },
        },
      });
    }

    if (!challenge) {
      return null;
    }

    // 날짜를 YYYY-MM-DD 형식 문자열로 반환 (UTC 기준)
    const formatDate = (date: Date | null) => {
      if (!date) return null;
      return date.toISOString().split('T')[0];
    };

    return {
      id: challenge.id,
      productName: challenge.product.name,
      startDate: formatDate(challenge.activatedAt),
      endDate: formatDate(challenge.expiresAt),
      totalPoints: challenge.totalPoints,
      status: challenge.status,
    };
  }
}
