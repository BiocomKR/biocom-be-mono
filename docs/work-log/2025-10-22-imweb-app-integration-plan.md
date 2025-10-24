# 아임웹 챌린지 선구매 → 앱 런칭 통합 계획서

**날짜**: 2025-10-22
**작성자**: Claude Code
**목적**: 아임웹 PC 쇼핑몰 선구매 고객을 앱 런칭 시 통합하는 전략 수립

---

## 📋 배경 및 전제 조건

### 프로젝트 배경
- **기존 시스템**: 아임웹 기반 PC 쇼핑몰 운영 중 (데이터 연동 불가능)
- **신규 개발**: 앱 전용 백엔드 + 건강 챌린지 시스템 (완전 새로 구축)
- **목표**: 아임웹의 한계를 벗어나 제대로 된 앱 서비스 구축

### 타임라인
- **현재 ~ 11월**: 아임웹에서 챌린지 상품 선구매 판매
- **11월 중순**: 개발 완료 목표
- **12월 중순**: 앱 런칭 예정

### 핵심 전제
1. ❌ **아임웹 회원 ≠ 앱 회원** (별도 계정, 연동 없음)
2. ✅ **동일인 판단 기준**: 휴대폰번호만 사용
3. ✅ **실시간 동기화**: 마이그레이션 없음, 홈화면 진입 시 API 호출
4. ✅ **무형 상품**: 재고 걱정 없음
5. ⚠️ **악독한 환불 정책**: 챌린지 시작일 설정 후 환불 불가

---

## 🎯 마케팅팀 고려사항

### 1. 판매 전략 설계

#### 1-1. 상품 판매 방식
**이슈:**
- 아임웹 상품이 앱 Product 테이블과 정확히 매칭되어야 함
- 매칭 실패 시 고객이 구매 내역을 찾을 수 없음

**권장 사항:**
- ✅ 아임웹 상품 등록 시 개발팀과 사전 협의
  - 상품명 정확히 일치
  - SKU 코드 부여 (매칭 키로 사용)
  - 챌린지 기간 정보 (21일, 30일 등)
- ✅ 무형 상품이므로 판매량 제한 없음
- ✅ 단, 서버 동시 접속 고려하여 일일 마케팅 물량 조절 권장

**상품 등록 예시:**
```
상품명: [21일] 다이어트 챌린지
SKU: CHALLENGE-DIET-21D
가격: 99,000원
카테고리: 챌린지
```

#### 1-2. 고객 기대치 관리
**이슈:**
- 선구매 고객이 "언제 시작할 수 있는지" 불명확
- 앱 런칭 전 구매자의 불안감

**권장 사항:**
상품 상세 페이지에 명확히 고지:
```
📱 이용 안내
• 본 상품은 2025년 12월 중순 앱 출시 후 사용 가능합니다
• 앱 다운로드 후 구매 시 등록한 휴대폰번호로 가입하세요
• 시작일 설정 전까지 100% 환불 가능
• ⚠️ 챌린지 시작일 설정 후에는 환불 불가
```

**FAQ 필수 항목:**
```
Q: 언제 시작할 수 있나요?
A: 2025년 12월 중순 앱 출시 후, 본인이 원하는 시작일을 설정하여 시작하실 수 있습니다.

Q: 다른 휴대폰번호로 가입하면 어떻게 되나요?
A: 구매 시 입력한 휴대폰번호와 일치하지 않으면 구매 내역이 조회되지 않습니다.
   반드시 구매 시 등록한 번호로 앱 가입을 해주세요.

Q: 환불이 가능한가요?
A: 챌린지 시작일 설정 전까지는 100% 환불 가능합니다.
   단, 시작일을 설정하여 챌린지가 활성화된 후에는 환불이 불가능합니다.

Q: 기존 쇼핑몰 계정과 연동되나요?
A: 아니요. 앱은 별도의 회원 시스템을 사용합니다.
   단, 구매 시 입력한 휴대폰번호로 가입하시면 자동으로 구매 내역이 조회됩니다.
```

#### 1-3. 환불 정책 (중요! ⚠️)

**악독한 정책의 법적 리스크:**
- 시작일 설정만 했는데 환불 불가는 소비자 반발 가능
- 전자상거래법 위반 소지 검토 필요

**필수 고지 사항:**
```
[환불 정책]
✅ 챌린지 시작 전: 100% 환불 가능
❌ 챌린지 시작일 설정 후: 환불 불가

※ 챌린지 시작일 설정은 서비스 이용 개시를 의미하며,
   이후에는 환불이 불가능합니다.
```

**앱 내 동의 절차:**
시작일 설정 화면에 팝업 필수:
```
⚠️ 챌린지 시작일 설정 확인

시작일을 설정하면 챌린지가 활성화되며,
이후 환불이 불가능합니다.

시작일: 2025-12-20

☐ 위 내용을 확인했으며 동의합니다

[취소]  [확인]
```

**법적 대비:**
- ✅ 이용약관에 환불 정책 명시
- ✅ 구매 완료 메일/문자에 환불 정책 포함
- ✅ 앱 내 시작일 설정 시 명확한 동의 체크박스
- ✅ "시작일 설정 = 서비스 이용 개시" 명확히 정의

---

### 2. 고객 커뮤니케이션

#### 2-1. 구매 완료 시점
**아임웹 주문 완료 메시지 템플릿:**
```
[바이오컴] 챌린지 구매 완료!

📱 앱 출시: 2025년 12월 중순 예정
📲 앱 다운로드 후 이 번호(010-xxxx-xxxx)로 가입
⚠️ 다른 번호로 가입 시 구매 내역 조회 안됨
💰 환불: 챌린지 시작 전까지 가능

앱 출시 시 안내 문자를 발송해드립니다.
📞 문의: 고객센터 000-0000
```

**주요 포인트:**
- 구매한 휴대폰번호 명시
- 동일 번호로 가입 필수임을 강조
- 환불 정책 간략히 안내

#### 2-2. 앱 런칭 시점 (D-Day)
**런칭 당일 SMS:**
```
[바이오컴] 앱 출시 완료! 🎉

📲 다운로드: [iOS 링크] / [AOS 링크]

⚠️ 반드시 구매 시 휴대폰번호(010-xxxx-xxxx)로 가입
✅ 가입 후 "내 챌린지"에서 구매 내역 확인

문의: 고객센터 000-0000
```

**카카오톡 알림톡 (선택):**
```
[바이오컴] 챌린지 앱 출시! 🎉

구매하신 챌린지를 이제 시작하실 수 있습니다.

1️⃣ 앱 다운로드
   iOS: [링크]
   Android: [링크]

2️⃣ 구매 시 휴대폰번호로 가입
   (010-xxxx-xxxx)

3️⃣ "내 챌린지" 메뉴에서 구매 내역 확인

4️⃣ 원하는 시작일 설정 후 챌린지 시작!

⚠️ 시작일 설정 후에는 환불이 불가능하니 신중히 선택해주세요.

문의: 고객센터 000-0000
```

#### 2-3. 고객 문의 대응 매뉴얼

**예상 문의 1: "내 구매내역이 안보여요"**
```
대응 스크립트:

1. 가입 시 사용한 휴대폰번호 확인
   "가입 시 어떤 휴대폰번호로 하셨나요?"

2. 구매 시 휴대폰번호 확인
   "주문번호 [XXX]의 구매자 정보를 확인해보니
    010-1234-5678로 구매하셨습니다."

3. 불일치 시
   "죄송합니다. 기술적으로 다른 번호로 계정 변경이 불가능합니다.
    환불 처리 후 올바른 번호로 재구매를 도와드리겠습니다."

4. 일치하는데도 안보이는 경우
   "기술팀에 확인 요청드리겠습니다.
    1시간 이내 재확인 연락드리겠습니다."
   → 개발팀 핫라인 연락
```

**예상 문의 2: "시작일 설정했는데 환불하고 싶어요"**
```
대응 스크립트:

1. 환불 불가 안내
   "죄송합니다. 챌린지 시작일 설정 후에는 환불이 불가능합니다.
    시작일 설정 시 환불 불가 정책에 동의하셨습니다."

2. 구매 시 고지 확인
   "구매 완료 문자와 앱 내 시작일 설정 화면에서
    해당 내용을 안내드렸습니다."

3. 예외 케이스
   - 앱 오류로 챌린지 진행 불가: 환불 승인
   - 단순 변심: 환불 불가

4. 고객 불만 시
   "불편을 드려 죄송합니다.
    담당자와 상담 후 재연락드리겠습니다."
   → 팀장 에스컬레이션
```

**예상 문의 3: "다른 번호로 가입했는데 옮길 수 있나요?"**
```
대응 스크립트:

1. 기술적 불가 안내
   "죄송합니다. 보안상의 이유로
    구매 내역을 다른 계정으로 이전하는 것은 불가능합니다."

2. 해결 방안 제시
   "환불 처리 후 올바른 휴대폰번호로 재구매를 도와드리겠습니다.
    환불은 영업일 기준 3-5일 소요됩니다."

3. 재구매 할인 제공 (선택)
   "불편을 드린 점 양해 부탁드리며,
    재구매 시 10% 할인 쿠폰을 제공해드리겠습니다."
```

**고객센터 핫라인 운영:**
- 런칭 D-Day ~ D+3: 오전 9시 ~ 오후 10시 운영
- 개발팀 긴급 연락망 구축
- 실시간 이슈 공유 채널 운영 (Slack, 카톡)

---

### 3. 리스크 관리

#### 3-1. 환불 정책 리스크 대응

**리스크 시나리오:**
- 고객: "시작일만 설정했는데 환불 안된다니 사기 아닌가요?"
- 소비자 보호 기관 신고 가능성
- 온라인 커뮤니티 부정적 리뷰

**사전 대응:**
- ✅ 모든 접점에서 환불 정책 명확히 고지
- ✅ 법무팀 검토 완료
- ✅ 이용약관에 상세히 명시
- ✅ 앱 내 동의 절차 강화

**사후 대응:**
- 소비자 보호원 분쟁 대비 자료 준비
  - 구매 완료 문자 내역
  - 앱 내 동의 화면 캡처
  - 이용약관 명시 내역
- 부정적 리뷰 모니터링 및 신속 대응
- 예외 환불 승인 기준 마련 (앱 오류 등)

#### 3-2. 휴대폰번호 불일치 리스크

**리스크 정량화:**
- 예상 불일치율: 5-10%
- 100명 구매 시 5-10명 문의 예상

**최소화 전략:**
- ✅ 모든 커뮤니케이션에 휴대폰번호 강조
- ✅ 앱 회원가입 첫 화면에 안내 배너:
  ```
  💡 아임웹 쇼핑몰에서 챌린지를 구매하셨나요?
  구매 시 입력한 휴대폰번호로 가입해야
  구매 내역이 자동으로 연동됩니다!
  ```
- ✅ 회원가입 완료 후 즉시 홈화면 진입
  → 구매 내역 자동 감지 → "챌린지가 추가되었습니다!" 알림

**발생 시 대응:**
- 환불 + 재구매 지원
- 재구매 시 할인 쿠폰 제공 (고객 불만 완화)
- 수동 처리는 절대 금지 (보안 리스크)

#### 3-3. 앱 출시 지연 리스크

**시나리오:**
- 개발 지연으로 12월 중순 런칭 불가
- 선구매 고객 환불 요청 급증

**대응 계획:**
- ✅ 지연 확정 시 즉시 공지 (최소 2주 전)
- ✅ 보상 정책:
  - 추가 포인트 지급
  - 할인 쿠폰 제공
  - 전액 환불 허용 (선택권)
- ✅ 투명한 소통 (개발 진행 상황 공유)

---

## 💻 개발팀 고려사항

### 1. 실시간 동기화 시스템

#### 1-1. 기본 흐름도
```
사용자 앱 런칭 (홈화면 진입)
         ↓
    GET /home API 호출
         ↓
Backend: 사용자 휴대폰번호 조회
         ↓
아임웹 API 호출 (휴대폰번호로 주문 조회)
         ↓
신규 주문 발견?
    ├─ Yes → ChallengeTicket 생성 (PURCHASED)
    │         + 신규 챌린지 알림 포함
    └─ No  → 기존 홈 데이터만 리턴
```

#### 1-2. API 상세 로직
```typescript
// GET /home
async getHome(userId: number) {
  try {
    // 1. 백그라운드 동기화 (비동기, await 없음)
    this.syncImwebOrdersAsync(userId).catch(err => {
      this.logger.error('아임웹 동기화 실패', err);
    });

    // 2. 홈 데이터 즉시 리턴 (동기화 완료 기다리지 않음)
    const homeData = await this.getHomeData(userId);

    // 3. 최근 5분 이내 생성된 신규 티켓 확인
    const newTickets = await this.prisma.challengeTicket.findMany({
      where: {
        userId,
        status: 'PURCHASED',
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
      },
      include: { product: true }
    });

    // 4. 신규 챌린지 알림 추가
    return {
      ...homeData,
      notifications: newTickets.length > 0 ? {
        type: 'NEW_CHALLENGE',
        title: '새로운 챌린지가 추가되었습니다! 🎉',
        message: `${newTickets.map(t => t.product.name).join(', ')}`,
        ticketIds: newTickets.map(t => t.id),
        action: 'GO_TO_MY_TICKETS'
      } : null
    };
  } catch (error) {
    this.logger.error('홈 조회 실패', error);
    throw error;
  }
}

// 아임웹 주문 동기화 (백그라운드)
private async syncImwebOrdersAsync(userId: number): Promise<void> {
  try {
    // 1. 사용자 휴대폰번호 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mobile: true }
    });

    if (!user?.mobile) {
      this.logger.warn(`사용자 ${userId} 휴대폰번호 없음`);
      return;
    }

    // 2. 캐시 확인 (Redis, 5분)
    const cacheKey = `imweb_orders:${user.mobile}`;
    let imwebOrders = await this.redis.get(cacheKey);

    if (!imwebOrders) {
      // 3. 아임웹 API 호출
      imwebOrders = await this.imwebApi.getOrdersByMobile(user.mobile);
      await this.redis.setex(cacheKey, 300, JSON.stringify(imwebOrders));
    } else {
      imwebOrders = JSON.parse(imwebOrders);
    }

    // 4. 챌린지 상품만 필터링
    const challengeOrders = imwebOrders.filter(order =>
      this.isChallengeOrder(order)
    );

    // 5. 신규 주문 처리
    for (const order of challengeOrders) {
      await this.processImwebOrder(userId, order);
    }

    this.logger.log(`아임웹 동기화 완료 - 사용자: ${userId}, 주문: ${challengeOrders.length}건`);
  } catch (error) {
    this.logger.error(`아임웹 동기화 실패 - 사용자: ${userId}`, error);
    // 에러 발생해도 홈 화면 로딩에는 영향 없음
  }
}

// 챌린지 주문 판별
private isChallengeOrder(order: ImwebOrder): boolean {
  // 방법 1: 카테고리 코드
  if (order.productCategory === 'CHALLENGE') return true;

  // 방법 2: SKU 접두사
  if (order.productSKU?.startsWith('CHALLENGE-')) return true;

  // 방법 3: 상품명 패턴
  if (order.productName.includes('챌린지')) return true;

  return false;
}

// 개별 주문 처리
private async processImwebOrder(userId: number, order: ImwebOrder): Promise<void> {
  try {
    // 1. 중복 체크
    const existing = await this.prisma.challengeTicket.findUnique({
      where: {
        externalOrderId_externalSource: {
          externalOrderId: order.orderId,
          externalSource: 'IMWEB'
        }
      }
    });

    if (existing) {
      this.logger.debug(`이미 처리된 주문: ${order.orderId}`);
      return; // 중복 방지
    }

    // 2. 상품 매칭
    const product = await this.matchProduct(order);

    if (!product) {
      this.logger.error(`상품 매칭 실패 - 주문: ${order.orderId}, 상품명: ${order.productName}, SKU: ${order.productSKU}`);
      // TODO: 관리자 알림 발송
      return;
    }

    // 3. 티켓 생성
    const ticket = await this.prisma.challengeTicket.create({
      data: {
        userId,
        productId: product.id,
        externalOrderId: order.orderId,
        externalSource: 'IMWEB',
        purchaseDate: new Date(order.orderDate),
        status: 'PURCHASED',
        createdAt: getNowKST(),
      }
    });

    this.logger.log(`아임웹 주문 처리 완료 - 주문: ${order.orderId}, 티켓: ${ticket.id}, 상품: ${product.name}`);
  } catch (error) {
    this.logger.error(`주문 처리 실패: ${order.orderId}`, error);
    // TODO: 실패 로그 저장, 관리자 알림
  }
}

// 상품 매칭 로직
private async matchProduct(order: ImwebOrder): Promise<Product | null> {
  // 우선순위 1: SKU 매칭 (가장 정확)
  if (order.productSKU) {
    const product = await this.prisma.product.findFirst({
      where: {
        sku: order.productSKU,
        categoryCode: 'CHALLENGE',
        status: 'ACTIVE'
      }
    });
    if (product) return product;
  }

  // 우선순위 2: 상품명 정확 일치
  const exactMatch = await this.prisma.product.findFirst({
    where: {
      name: order.productName,
      categoryCode: 'CHALLENGE',
      status: 'ACTIVE'
    }
  });
  if (exactMatch) return exactMatch;

  // 우선순위 3: 상품명 부분 일치 (fallback)
  const partialMatch = await this.prisma.product.findFirst({
    where: {
      name: { contains: order.productName },
      categoryCode: 'CHALLENGE',
      status: 'ACTIVE'
    }
  });

  return partialMatch;
}
```

#### 1-3. 아임웹 API 인터페이스
```typescript
// 아임웹 API 응답 타입 정의
interface ImwebOrder {
  orderId: string;          // 주문번호 (예: "IM20251020001")
  orderDate: string;        // 주문일시 (ISO 8601)
  productId: string;        // 아임웹 상품 ID
  productName: string;      // 상품명
  productSKU?: string;      // SKU 코드
  productCategory?: string; // 카테고리
  quantity: number;         // 수량
  price: number;           // 가격
  customerName: string;    // 구매자명
  customerMobile: string;  // 구매자 휴대폰
  orderStatus: string;     // 주문 상태
}

// 아임웹 API 서비스
class ImwebApiService {
  private readonly baseUrl = 'https://api.imweb.me';
  private readonly apiKey = process.env.IMWEB_API_KEY;

  // 휴대폰번호로 주문 조회
  async getOrdersByMobile(mobile: string): Promise<ImwebOrder[]> {
    try {
      // 휴대폰번호 정규화 (010-1234-5678 → 01012345678)
      const normalizedMobile = mobile.replace(/-/g, '');

      const response = await axios.get(`${this.baseUrl}/orders`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        params: {
          customer_mobile: normalizedMobile,
          status: 'paid', // 결제 완료된 주문만
          limit: 100
        },
        timeout: 5000 // 5초 타임아웃
      });

      return response.data.orders.map(this.transformOrder);
    } catch (error) {
      this.logger.error('아임웹 API 호출 실패', error);
      throw error;
    }
  }

  // 아임웹 응답 → 내부 모델 변환
  private transformOrder(imwebData: any): ImwebOrder {
    return {
      orderId: imwebData.order_no,
      orderDate: imwebData.order_date,
      productId: imwebData.product_id,
      productName: imwebData.product_name,
      productSKU: imwebData.product_code,
      productCategory: imwebData.category_name,
      quantity: imwebData.quantity,
      price: imwebData.price,
      customerName: imwebData.orderer_name,
      customerMobile: imwebData.orderer_phone,
      orderStatus: imwebData.status
    };
  }
}
```

---

### 2. 데이터베이스 설계

#### 2-1. ChallengeTicket 테이블 수정

**현재 스키마:**
```prisma
model ChallengeTicket {
  id             Int             @id @default(autoincrement())
  userId         Int             @map("user_id")
  productId      Int?            @map("product_id")
  orderItemId    Int?            @map("order_item_id")
  purchaseDate   DateTime        @map("purchase_date")
  status         String          @default("PURCHASED") @db.VarChar(20)
  createdAt      DateTime        @map("created_at")
  updatedAt      DateTime?       @updatedAt @map("updated_at")
  ticketType     String          @default("CHALLENGE") @map("ticket_type") @db.VarChar(20)
  startDate      DateTime?       @map("start_date")
  endDate        DateTime?       @map("end_date")

  orderItem      OrderItem?      @relation(fields: [orderItemId], references: [id])
  product        Product?        @relation(fields: [productId], references: [id])
  user           User            @relation(fields: [userId], references: [id])
  userChallenges UserChallenge[]

  @@index([userId, status, ticketType])
  @@map("challenge_tickets")
}
```

**수정 필요 사항:**
```prisma
model ChallengeTicket {
  id              Int             @id @default(autoincrement())
  userId          Int             @map("user_id")
  productId       Int?            @map("product_id")
  orderItemId     Int?            @map("order_item_id")
  externalOrderId String?         @map("external_order_id") @db.VarChar(100)  // ⭐ 추가
  externalSource  String?         @map("external_source") @db.VarChar(20)     // ⭐ 추가
  purchaseDate    DateTime        @map("purchase_date")
  status          String          @default("PURCHASED") @db.VarChar(20)
  createdAt       DateTime        @map("created_at")
  updatedAt       DateTime?       @updatedAt @map("updated_at")
  ticketType      String          @default("CHALLENGE") @map("ticket_type") @db.VarChar(20)
  startDate       DateTime?       @map("start_date")
  endDate         DateTime?       @map("end_date")

  orderItem       OrderItem?      @relation(fields: [orderItemId], references: [id])
  product         Product?        @relation(fields: [productId], references: [id])
  user            User            @relation(fields: [userId], references: [id])
  userChallenges  UserChallenge[]

  @@unique([externalOrderId, externalSource])  // ⭐ 중복 방지
  @@index([userId, status, ticketType])
  @@index([externalOrderId])                   // ⭐ 조회 성능
  @@map("challenge_tickets")
}
```

**필드 설명:**
- `externalOrderId`: 아임웹 주문번호 (예: "IM20251020001")
- `externalSource`: 출처 구분 ("IMWEB", "INTERNAL", "ADMIN")
- `@@unique`: 같은 아임웹 주문을 중복 처리 방지

**마이그레이션 스크립트:**
```sql
-- 필드 추가
ALTER TABLE challenge_tickets
ADD COLUMN external_order_id VARCHAR(100),
ADD COLUMN external_source VARCHAR(20);

-- 유니크 제약 조건
ALTER TABLE challenge_tickets
ADD CONSTRAINT challenge_tickets_external_order_id_external_source_key
UNIQUE (external_order_id, external_source);

-- 인덱스 추가
CREATE INDEX challenge_tickets_external_order_id_idx
ON challenge_tickets(external_order_id);

-- 기존 데이터 업데이트 (내부 주문)
UPDATE challenge_tickets
SET external_source = 'INTERNAL'
WHERE order_item_id IS NOT NULL
  AND external_source IS NULL;
```

#### 2-2. Product 테이블 SKU 필드 확인

**현재 스키마 확인 필요:**
```prisma
model Product {
  id          Int     @id @default(autoincrement())
  name        String
  sku         String? @unique  // ⭐ 있는지 확인, 없으면 추가
  categoryCode String @map("category_code")
  // ...
}
```

**없으면 추가:**
```sql
ALTER TABLE products
ADD COLUMN sku VARCHAR(100) UNIQUE;

CREATE INDEX products_sku_idx ON products(sku);
```

---

### 3. 환불 처리

#### 3-1. 환불 API 구현

```typescript
// POST /challenges/tickets/:ticketId/refund

@Post('tickets/:ticketId/refund')
@ApiOperation({
  summary: '챌린지 티켓 환불',
  description: '챌린지 시작 전 티켓을 환불합니다. 시작일 설정 후에는 환불 불가능합니다.'
})
@ApiResponse({
  status: 200,
  description: '환불 요청 접수 성공'
})
@ApiResponse({
  status: 400,
  description: '환불 불가능한 상태 (ACTIVATED, REFUNDED 등)'
})
async refundTicket(
  @Param('ticketId', ParseIntPipe) ticketId: number,
  @Request() req: any
) {
  return this.challengeService.refundTicket(req.user.userId, ticketId);
}

// Service
async refundTicket(userId: number, ticketId: number) {
  try {
    this.logger.log(`티켓 환불 요청 - 사용자: ${userId}, 티켓: ${ticketId}`);

    return await this.prisma.$transaction(async (tx) => {
      // 1. 티켓 조회
      const ticket = await tx.challengeTicket.findFirst({
        where: {
          id: ticketId,
          userId
        },
        include: { product: true }
      });

      if (!ticket) {
        throw new NotFoundException('티켓을 찾을 수 없습니다');
      }

      // 2. 환불 가능 상태 확인
      if (ticket.status === 'ACTIVATED') {
        throw new BadRequestException(
          '챌린지 시작 후에는 환불이 불가능합니다. ' +
          '시작일 설정 시 환불 불가 정책에 동의하셨습니다.'
        );
      }

      if (ticket.status === 'REFUNDED') {
        throw new BadRequestException('이미 환불된 티켓입니다');
      }

      if (ticket.status !== 'PURCHASED') {
        throw new BadRequestException(`환불 가능한 상태가 아닙니다 (현재: ${ticket.status})`);
      }

      // 3. 티켓 상태 변경
      const refundedTicket = await tx.challengeTicket.update({
        where: { id: ticketId },
        data: {
          status: 'REFUNDED',
          updatedAt: getNowKST()
        }
      });

      // 4. 환불 요청 알림 (관리자)
      if (ticket.externalSource === 'IMWEB') {
        await this.notifyImwebRefundRequest({
          ticketId: ticket.id,
          externalOrderId: ticket.externalOrderId,
          userId,
          productName: ticket.product.name,
          purchaseDate: ticket.purchaseDate
        });
      }

      this.logger.log(`티켓 환불 완료 - 티켓: ${ticketId}, 출처: ${ticket.externalSource}`);

      return {
        success: true,
        message: ticket.externalSource === 'IMWEB'
          ? '환불 요청이 접수되었습니다. 영업일 기준 3-5일 내 환불 처리됩니다.'
          : '환불이 완료되었습니다.'
      };
    });
  } catch (error) {
    this.logger.error(`티켓 환불 실패 - 티켓: ${ticketId}`, error);
    throw error;
  }
}

// 아임웹 환불 요청 알림
private async notifyImwebRefundRequest(data: {
  ticketId: number;
  externalOrderId: string;
  userId: number;
  productName: string;
  purchaseDate: DateTime;
}) {
  // Slack 알림
  await this.slackService.send({
    channel: '#imweb-refunds',
    text: `🔴 아임웹 환불 요청\n\n` +
          `티켓 ID: ${data.ticketId}\n` +
          `아임웹 주문번호: ${data.externalOrderId}\n` +
          `사용자 ID: ${data.userId}\n` +
          `상품명: ${data.productName}\n` +
          `구매일: ${data.purchaseDate}\n\n` +
          `아임웹 관리자 페이지에서 수동 환불 처리 필요`
  });

  // 이메일 알림 (선택)
  await this.mailService.send({
    to: 'admin@biocom.kr',
    subject: '[긴급] 아임웹 환불 요청',
    body: `...`
  });
}
```

#### 3-2. 시작일 설정 API (환불 불가 동의 추가)

```typescript
// DTO 수정
export class SetStartDateDto {
  @ApiProperty({
    description: '챌린지 시작일 (YYYY-MM-DD)',
    example: '2025-12-20'
  })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: '환불 불가 정책 동의 여부',
    example: true
  })
  @IsBoolean()
  @IsNotEmpty()
  agreeNoRefund: boolean;  // ⭐ 추가
}

// Service 수정
async setStartDate(userId: number, productId: number, dto: SetStartDateDto) {
  try {
    // 1. 동의 확인
    if (!dto.agreeNoRefund) {
      throw new BadRequestException(
        '챌린지 시작일 설정 후에는 환불이 불가능합니다. ' +
        '환불 불가 정책에 동의해야 시작일을 설정할 수 있습니다.'
      );
    }

    // 기존 로직...
    // - 중복 ACTIVE 체크
    // - PURCHASED 티켓 조회
    // - UserChallenge 생성 (ACTIVE)
    // - ChallengeTicket 상태 변경 (ACTIVATED)

    this.logger.log(`챌린지 시작일 설정 완료 - 환불 불가 동의 확인됨`);

    // ...
  } catch (error) {
    this.logger.error('챌린지 시작일 설정 실패', error);
    throw error;
  }
}
```

**프론트엔드 UI:**
```typescript
// 시작일 설정 화면
<Dialog>
  <DialogTitle>⚠️ 챌린지 시작일 설정 확인</DialogTitle>
  <DialogContent>
    <Typography>
      시작일을 설정하면 챌린지가 활성화되며,<br/>
      <strong>이후 환불이 불가능합니다.</strong>
    </Typography>

    <Box mt={2}>
      <Typography variant="body2">시작일: {selectedDate}</Typography>
      <Typography variant="body2">배송일: {deliveryDate} (시작일 -1일)</Typography>
      <Typography variant="body2">종료일: {endDate} (시작일 +20일)</Typography>
    </Box>

    <FormControlLabel
      control={<Checkbox checked={agreed} onChange={handleAgree} />}
      label="위 내용을 확인했으며 환불 불가 정책에 동의합니다"
    />
  </DialogContent>

  <DialogActions>
    <Button onClick={handleCancel}>취소</Button>
    <Button
      onClick={handleConfirm}
      disabled={!agreed}
      color="primary"
    >
      확인
    </Button>
  </DialogActions>
</Dialog>
```

---

### 4. 성능 최적화

#### 4-1. 캐싱 전략

**Redis 캐싱 구조:**
```typescript
// 캐시 키: imweb_orders:{휴대폰번호}
// TTL: 300초 (5분)
// 값: JSON 문자열 (ImwebOrder[])

class CacheService {
  async getImwebOrders(mobile: string): Promise<ImwebOrder[] | null> {
    const key = `imweb_orders:${mobile}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setImwebOrders(mobile: string, orders: ImwebOrder[]): Promise<void> {
    const key = `imweb_orders:${mobile}`;
    await this.redis.setex(key, 300, JSON.stringify(orders));
  }

  async invalidateImwebOrders(mobile: string): Promise<void> {
    const key = `imweb_orders:${mobile}`;
    await this.redis.del(key);
  }
}
```

**캐싱 전략:**
- 홈화면 진입 시: 캐시 확인 → 없으면 API 호출 → 캐시 저장
- 티켓 생성 후: 캐시 무효화 (다음 진입 시 최신 데이터 조회)
- TTL: 5분 (너무 길면 실시간성 떨어짐, 너무 짧으면 API 부하)

#### 4-2. 데이터베이스 인덱스

**필수 인덱스:**
```sql
-- 1. ChallengeTicket 조회 최적화
CREATE INDEX idx_challenge_tickets_user_status
ON challenge_tickets(user_id, status);

CREATE INDEX idx_challenge_tickets_external
ON challenge_tickets(external_order_id);

-- 2. Product SKU 매칭 최적화
CREATE INDEX idx_products_sku
ON products(sku);

CREATE INDEX idx_products_category_status
ON products(category_code, status);

-- 3. UserChallenge ACTIVE 체크 최적화
CREATE INDEX idx_user_challenges_user_status
ON user_challenges(user_id, status);
```

**쿼리 성능 목표:**
- ChallengeTicket 조회: < 10ms
- Product 매칭: < 20ms
- 중복 체크: < 10ms
- 전체 동기화: < 500ms

#### 4-3. 아임웹 API Rate Limiting

**이슈:**
- 동시 접속 급증 시 아임웹 API Rate Limit 초과 가능
- API 호출 실패 → 사용자 경험 저하

**대책:**
```typescript
// Rate Limiter 구현 (Bull Queue 사용)
class ImwebApiQueue {
  private queue: Queue;

  constructor() {
    this.queue = new Bull('imweb-api', {
      redis: { host: 'localhost', port: 6379 },
      limiter: {
        max: 10,        // 초당 10개 요청
        duration: 1000  // 1초
      }
    });

    this.queue.process(this.processJob.bind(this));
  }

  async addJob(mobile: string, userId: number): Promise<void> {
    await this.queue.add({ mobile, userId }, {
      attempts: 3,      // 3회 재시도
      backoff: {
        type: 'exponential',
        delay: 2000     // 2초, 4초, 8초
      }
    });
  }

  private async processJob(job: Job): Promise<void> {
    const { mobile, userId } = job.data;
    const orders = await this.imwebApi.getOrdersByMobile(mobile);

    for (const order of orders) {
      await this.processImwebOrder(userId, order);
    }
  }
}
```

---

### 5. 모니터링 및 알림

#### 5-1. 모니터링 지표

**수집 지표:**
```typescript
// 1. 아임웹 동기화 성공률
- imweb_sync_success_total
- imweb_sync_failure_total
- imweb_sync_duration_seconds

// 2. 주문 처리 현황
- imweb_orders_processed_total
- imweb_orders_matched_total (상품 매칭 성공)
- imweb_orders_unmatched_total (상품 매칭 실패)

// 3. 티켓 생성 현황
- challenge_tickets_created_total
- challenge_tickets_activated_total
- challenge_tickets_refunded_total

// 4. API 응답 시간
- home_api_duration_seconds
- imweb_api_duration_seconds
```

**Prometheus 메트릭:**
```typescript
import { Counter, Histogram } from 'prom-client';

// 동기화 성공 카운터
const syncSuccessCounter = new Counter({
  name: 'imweb_sync_success_total',
  help: 'Total number of successful imweb syncs'
});

// 동기화 실패 카운터
const syncFailureCounter = new Counter({
  name: 'imweb_sync_failure_total',
  help: 'Total number of failed imweb syncs',
  labelNames: ['error_type']
});

// 동기화 소요 시간
const syncDurationHistogram = new Histogram({
  name: 'imweb_sync_duration_seconds',
  help: 'Duration of imweb sync in seconds',
  buckets: [0.1, 0.5, 1, 2, 5]
});

// 사용 예시
async syncImwebOrdersAsync(userId: number) {
  const timer = syncDurationHistogram.startTimer();

  try {
    await this.performSync(userId);
    syncSuccessCounter.inc();
  } catch (error) {
    syncFailureCounter.inc({ error_type: error.constructor.name });
    throw error;
  } finally {
    timer();
  }
}
```

#### 5-2. 알림 정책

**Slack 알림:**
```typescript
// 1. 상품 매칭 실패 (즉시)
if (!product) {
  await this.slackService.send({
    channel: '#imweb-alerts',
    text: `⚠️ 상품 매칭 실패\n\n` +
          `주문번호: ${order.orderId}\n` +
          `상품명: ${order.productName}\n` +
          `SKU: ${order.productSKU}\n` +
          `사용자 ID: ${userId}\n\n` +
          `Product 테이블에 해당 상품을 추가해주세요.`
  });
}

// 2. 동기화 실패율 급증 (10% 이상, 5분마다)
if (failureRate > 0.1) {
  await this.slackService.send({
    channel: '#critical-alerts',
    text: `🚨 아임웹 동기화 실패율 급증!\n\n` +
          `실패율: ${failureRate * 100}%\n` +
          `최근 5분간 실패: ${failureCount}건\n\n` +
          `아임웹 API 상태 확인 필요`
  });
}

// 3. 환불 요청 (즉시)
// 위에서 구현한 notifyImwebRefundRequest 참고
```

#### 5-3. 대시보드

**Grafana 대시보드 패널:**
```
[아임웹 동기화 현황]
- 성공률 게이지 (목표: 95% 이상)
- 시간당 처리 건수 그래프
- 평균 응답 시간 그래프

[주문 처리 현황]
- 총 처리 주문 수
- 매칭 성공/실패 비율
- 실패 주문 목록 (테이블)

[티켓 현황]
- 상태별 티켓 수 (PURCHASED, ACTIVATED, REFUNDED)
- 일자별 생성/활성화 추이
- 환불율 그래프

[에러 로그]
- 최근 에러 목록 (테이블)
- 에러 타입별 발생 빈도
```

---

### 6. 테스트 계획

#### 6-1. 단위 테스트

```typescript
describe('ImwebIntegrationService', () => {
  describe('syncImwebOrders', () => {
    it('should create ticket for new order', async () => {
      // Given
      const mockOrder = {
        orderId: 'IM20251020001',
        productName: '[21일] 다이어트 챌린지',
        productSKU: 'CHALLENGE-DIET-21D',
        // ...
      };

      // When
      await service.syncImwebOrders(userId);

      // Then
      const ticket = await prisma.challengeTicket.findFirst({
        where: { externalOrderId: mockOrder.orderId }
      });
      expect(ticket).toBeDefined();
      expect(ticket.status).toBe('PURCHASED');
    });

    it('should not create duplicate ticket', async () => {
      // Given: 이미 처리된 주문
      await prisma.challengeTicket.create({
        data: {
          externalOrderId: 'IM20251020001',
          externalSource: 'IMWEB',
          // ...
        }
      });

      // When: 같은 주문 재처리
      await service.syncImwebOrders(userId);

      // Then: 중복 생성 안됨
      const count = await prisma.challengeTicket.count({
        where: { externalOrderId: 'IM20251020001' }
      });
      expect(count).toBe(1);
    });
  });

  describe('matchProduct', () => {
    it('should match by SKU', async () => {
      // Given
      const product = await createTestProduct({ sku: 'CHALLENGE-DIET-21D' });
      const order = { productSKU: 'CHALLENGE-DIET-21D' };

      // When
      const matched = await service.matchProduct(order);

      // Then
      expect(matched.id).toBe(product.id);
    });

    it('should match by name when SKU is null', async () => {
      // Given
      const product = await createTestProduct({ name: '다이어트 챌린지' });
      const order = { productSKU: null, productName: '다이어트 챌린지' };

      // When
      const matched = await service.matchProduct(order);

      // Then
      expect(matched.id).toBe(product.id);
    });

    it('should return null when no match', async () => {
      // Given
      const order = { productSKU: 'UNKNOWN', productName: '존재하지 않는 상품' };

      // When
      const matched = await service.matchProduct(order);

      // Then
      expect(matched).toBeNull();
    });
  });
});

describe('ChallengeService', () => {
  describe('setStartDate', () => {
    it('should reject without agreement', async () => {
      // Given
      const dto = { startDate: '2025-12-20', agreeNoRefund: false };

      // When & Then
      await expect(
        service.setStartDate(userId, productId, dto)
      ).rejects.toThrow('환불 불가 정책에 동의해야');
    });

    it('should create UserChallenge when agreed', async () => {
      // Given
      const dto = { startDate: '2025-12-20', agreeNoRefund: true };

      // When
      await service.setStartDate(userId, productId, dto);

      // Then
      const userChallenge = await prisma.userChallenge.findFirst({
        where: { userId, productId, status: 'ACTIVE' }
      });
      expect(userChallenge).toBeDefined();
    });
  });

  describe('refundTicket', () => {
    it('should refund PURCHASED ticket', async () => {
      // Given
      const ticket = await createTestTicket({ status: 'PURCHASED' });

      // When
      await service.refundTicket(userId, ticket.id);

      // Then
      const refunded = await prisma.challengeTicket.findUnique({
        where: { id: ticket.id }
      });
      expect(refunded.status).toBe('REFUNDED');
    });

    it('should reject ACTIVATED ticket refund', async () => {
      // Given
      const ticket = await createTestTicket({ status: 'ACTIVATED' });

      // When & Then
      await expect(
        service.refundTicket(userId, ticket.id)
      ).rejects.toThrow('챌린지 시작 후에는 환불이 불가능');
    });
  });
});
```

#### 6-2. 통합 테스트

```typescript
describe('Imweb Integration (E2E)', () => {
  beforeAll(async () => {
    // 테스트 DB 초기화
    await setupTestDatabase();
    // 아임웹 Mock 서버 시작
    await startImwebMockServer();
  });

  it('full flow: signup → home → ticket created', async () => {
    // 1. 아임웹에 주문 생성 (Mock)
    const mockOrder = await createMockImwebOrder({
      customerMobile: '01012345678',
      productSKU: 'CHALLENGE-DIET-21D'
    });

    // 2. 앱 회원가입
    const signupResponse = await request(app)
      .post('/auth/signup')
      .send({
        email: 'test@test.com',
        password: 'password',
        mobile: '010-1234-5678',
        name: '테스터'
      });

    const { accessToken } = signupResponse.body.data;

    // 3. 홈화면 진입 (동기화 트리거)
    const homeResponse = await request(app)
      .get('/home')
      .set('Authorization', `Bearer ${accessToken}`);

    // 4. 티켓 생성 확인
    expect(homeResponse.body.data.notifications).toBeDefined();
    expect(homeResponse.body.data.notifications.type).toBe('NEW_CHALLENGE');

    // 5. 티켓 목록 조회
    const ticketsResponse = await request(app)
      .get('/challenges/my-tickets')
      .set('Authorization', `Bearer ${accessToken}`);

    const tickets = ticketsResponse.body.data;
    expect(tickets).toHaveLength(1);
    expect(tickets[0].status).toBe('PURCHASED');

    // 6. 시작일 설정
    const productId = tickets[0].challenge.id;
    const setStartDateResponse = await request(app)
      .post(`/challenges/${productId}/schedule/start-date`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        startDate: '2025-12-20',
        agreeNoRefund: true
      });

    expect(setStartDateResponse.status).toBe(201);

    // 7. 티켓 상태 확인 (ACTIVATED)
    const updatedTicketsResponse = await request(app)
      .get('/challenges/my-tickets')
      .set('Authorization', `Bearer ${accessToken}`);

    const updatedTickets = updatedTicketsResponse.body.data;
    expect(updatedTickets[0].status).toBe('ACTIVATED');

    // 8. 환불 시도 (실패해야 함)
    const refundResponse = await request(app)
      .post(`/challenges/tickets/${tickets[0].id}/refund`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(refundResponse.status).toBe(400);
    expect(refundResponse.body.message).toContain('챌린지 시작 후에는 환불이 불가능');
  });
});
```

#### 6-3. 성능 테스트

```typescript
// Artillery를 사용한 부하 테스트
// artillery.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10  # 초당 10명 접속
      name: "Warm up"
    - duration: 300
      arrivalRate: 50  # 초당 50명 접속
      name: "Peak load"

scenarios:
  - name: "홈화면 접속 (아임웹 동기화)"
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "{{ $randomEmail }}"
            password: "password"
          capture:
            - json: "$.data.accessToken"
              as: "token"
      - get:
          url: "/home"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200
            - contentType: json

# 실행
artillery run artillery.yml

# 목표
- 평균 응답 시간: < 500ms
- P95 응답 시간: < 1000ms
- 에러율: < 1%
```

---

### 7. 런칭 체크리스트

#### D-14일 (12월 1일)
- [ ] **개발 완료**
  - [ ] ChallengeTicket 스키마 수정 (externalOrderId, externalSource)
  - [ ] 아임웹 API 연동 구현
  - [ ] 홈화면 동기화 로직 구현
  - [ ] 환불 API 구현
  - [ ] SetStartDateDto 동의 필드 추가

- [ ] **테스트 완료**
  - [ ] 단위 테스트 (커버리지 80% 이상)
  - [ ] 통합 테스트 (E2E 시나리오)
  - [ ] 성능 테스트 (부하 테스트)

- [ ] **인프라 준비**
  - [ ] Redis 캐싱 설정
  - [ ] DB 인덱스 생성
  - [ ] 모니터링 대시보드 구축
  - [ ] Slack 알림 설정

#### D-7일 (12월 8일)
- [ ] **스테이징 환경 배포**
  - [ ] 아임웹 스테이징 API 연동 테스트
  - [ ] 더미 주문 생성 및 동기화 테스트
  - [ ] 캐싱 동작 확인
  - [ ] 알림 발송 테스트

- [ ] **마케팅 준비**
  - [ ] 상품 페이지 안내 문구 업데이트
  - [ ] 주문 완료 메시지 템플릿 등록
  - [ ] FAQ 작성
  - [ ] 고객센터 대응 매뉴얼 배포

#### D-3일 (12월 12일)
- [ ] **프로덕션 배포**
  - [ ] 앱 스토어 심사 통과 확인
  - [ ] 프로덕션 DB 마이그레이션 (스키마 수정)
  - [ ] 아임웹 프로덕션 API 키 설정
  - [ ] 모니터링 알림 활성화

- [ ] **최종 점검**
  - [ ] 아임웹 API Rate Limit 확인
  - [ ] Redis 캐시 동작 확인
  - [ ] DB 성능 확인 (인덱스)
  - [ ] 롤백 계획 준비

#### D-1일 (12월 14일)
- [ ] **런칭 준비**
  - [ ] 고객센터 대기 (09:00 ~ 22:00)
  - [ ] 개발팀 핫라인 구축
  - [ ] SMS 발송 준비 (템플릿 등록)
  - [ ] 실시간 모니터링 시작

#### D-Day (12월 15일)
- [ ] **앱 출시**
  - [ ] 09:00 - 앱 스토어 공개
  - [ ] 10:00 - 선구매 고객 SMS 발송
  - [ ] 12:00 - 1차 상황 점검 (접속, 동기화 성공률)
  - [ ] 18:00 - 2차 상황 점검
  - [ ] 22:00 - 일일 리포트 작성

#### D+1일 (12월 16일)
- [ ] **안정화**
  - [ ] 고객 문의 분석
  - [ ] "구매 내역 없음" 케이스 수집
  - [ ] 상품 매칭 실패 케이스 처리
  - [ ] 긴급 패치 필요 여부 판단

#### D+3일 (12월 18일)
- [ ] **회고**
  - [ ] 동기화 성공률 분석
  - [ ] 환불 요청 현황 분석
  - [ ] 고객 문의 유형별 통계
  - [ ] 개선사항 도출

---

## 🎯 핵심 리스크 및 대응

### 리스크 1: 휴대폰번호 불일치
**발생 확률**: 높음 (5-10%)
**영향도**: 중간

**대응:**
- 모든 커뮤니케이션에 휴대폰번호 강조
- 회원가입 화면 안내 배너
- 환불 + 재구매 지원 프로세스

### 리스크 2: 상품 매칭 실패
**발생 확률**: 중간 (3-5%)
**영향도**: 높음

**대응:**
- 사전 상품 정보 동기화 (마케팅 ↔ 개발)
- 매칭 실패 시 즉시 알림
- 수동 처리 가이드 준비

### 리스크 3: 아임웹 API 장애
**발생 확률**: 낮음 (1-2%)
**영향도**: 매우 높음

**대응:**
- 캐싱으로 영향 최소화
- Rate Limiter로 과부하 방지
- 장애 시 수동 CSV 업로드 대비

### 리스크 4: 환불 정책 민원
**발생 확률**: 중간 (5%)
**영향도**: 높음 (법적 리스크)

**대응:**
- 명확한 사전 고지
- 동의 절차 강화
- 예외 환불 기준 마련

### 리스크 5: 동시 접속 급증
**발생 확률**: 높음 (런칭 D-Day)
**영향도**: 중간

**대응:**
- 백그라운드 동기화로 홈 로딩 지연 방지
- 캐싱으로 API 부하 감소
- 인프라 스케일링 준비 (GKE Auto-scaling)

---

## 📈 성공 지표

### 기술 지표
- ✅ 아임웹 동기화 성공률: 95% 이상
- ✅ 상품 매칭 성공률: 97% 이상
- ✅ 홈 API 응답 시간: 평균 500ms 이하
- ✅ 에러율: 1% 이하

### 비즈니스 지표
- ✅ 선구매 고객 전환율: 80% 이상 (앱 가입)
- ✅ 챌린지 시작율: 60% 이상 (D+7일 기준)
- ✅ 환불율: 10% 이하
- ✅ 고객 만족도: 4.0/5.0 이상

### 운영 지표
- ✅ "구매 내역 없음" 문의: 전체의 5% 이하
- ✅ 평균 응답 시간: 1시간 이내
- ✅ 수동 처리 건수: 전체의 3% 이하

---

**작성 완료**: 2025-10-22
**다음 액션**: D-14일 체크리스트 시작
**문의**: 개발팀 핫라인 (Slack #imweb-integration)
