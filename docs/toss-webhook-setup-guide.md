# 🔔 토스페이먼츠 웹훅(Webhook) 설정 가이드

> **작성일**: 2025-11-10
> **대상**: 백엔드 개발자
> **목적**: 토스페이먼츠 콜백 URL 등록 및 웹훅 처리

---

## 📋 목차
1. [웹훅이란?](#1-웹훅이란)
2. [토스 개발자센터 설정](#2-토스-개발자센터-설정)
3. [백엔드 웹훅 엔드포인트 구현](#3-백엔드-웹훅-엔드포인트-구현)
4. [웹훅 검증 (보안)](#4-웹훅-검증-보안)
5. [테스트 방법](#5-테스트-방법)

---

## 1. 웹훅이란?

### 1.1 웹훅의 역할

**웹훅(Webhook)**은 토스페이먼츠 서버가 결제 상태 변경 시 우리 백엔드 API를 **자동으로 호출**하는 기능입니다.

```
┌─────────────────┐
│  토스 서버       │
└────────┬────────┘
         │ 결제 상태 변경 (예: 가상계좌 입금 완료)
         │
         ↓ HTTP POST 요청 (웹훅)
┌──────────────────────────────┐
│  우리 백엔드 API             │
│  POST /webhooks/toss/payment │
└──────────────────────────────┘
         │
         ↓ DB 업데이트
┌──────────────────────────────┐
│  orders 테이블 상태 업데이트  │
│  PENDING → PAID              │
└──────────────────────────────┘
```

### 1.2 웹훅이 필요한 경우

| 결제 방식 | 웹훅 필요 여부 | 이유 |
|----------|--------------|------|
| 카드 결제 | △ (선택) | 즉시 결제되므로 앱에서 승인 API 호출로 충분 |
| 가상계좌 | ✅ **필수** | 입금까지 시간이 걸리므로 웹훅으로 통보 받아야 함 |
| 계좌이체 | ✅ **필수** | 이체 완료 시점을 웹훅으로 받아야 함 |
| 휴대폰 결제 | △ (선택) | 즉시 결제되나 웹훅으로 이중 검증 가능 |

---

## 2. 토스 개발자센터 설정

### 2.1 토스페이먼츠 개발자센터 접속

1. **토스페이먼츠 개발자센터** 접속
   - URL: https://developers.tosspayments.com/

2. **로그인** (사업자 계정)

3. **내 앱** 선택
   - 테스트 환경: "테스트 키" 탭
   - 운영 환경: "라이브 키" 탭

### 2.2 웹훅 URL 등록

#### Step 1: 설정 메뉴 진입
```
개발자센터 → 내 앱 → [앱 선택] → 설정
```

#### Step 2: 웹훅 URL 입력

**테스트 환경**:
```
https://api-dev.biocom.ai.kr/webhooks/toss/payment
```

**운영 환경** (나중에 설정):
```
https://api.biocom.ai.kr/webhooks/toss/payment
```

#### Step 3: 웹훅 이벤트 선택

다음 이벤트들을 체크하세요:

- ✅ **결제 승인 완료** (`Payment.Approved`)
  - 가상계좌 입금 완료, 계좌이체 완료 등

- ✅ **결제 취소 완료** (`Payment.Canceled`)
  - 관리자나 사용자가 결제를 취소한 경우

- ✅ **결제 실패** (`Payment.Failed`)
  - 카드 한도 초과, 잔액 부족 등

#### Step 4: 저장

저장 버튼 클릭 → 웹훅 URL이 등록됩니다.

### 2.3 스크린샷 참고

```
┌──────────────────────────────────────────┐
│  토스페이먼츠 개발자센터                   │
├──────────────────────────────────────────┤
│  앱 이름: 바이브코딩                       │
│  환경: 테스트                              │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │ 웹훅 URL                             │ │
│  │ https://api-dev.biocom.ai.kr/       │ │
│  │ webhooks/toss/payment                │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  이벤트 선택:                              │
│  ☑ 결제 승인 완료 (Payment.Approved)      │
│  ☑ 결제 취소 완료 (Payment.Canceled)      │
│  ☑ 결제 실패 (Payment.Failed)             │
│                                           │
│  [저장]                                   │
└──────────────────────────────────────────┘
```

---

## 3. 백엔드 웹훅 엔드포인트 구현

### 3.1 컨트롤러 생성

**파일**: `src/shop/controllers/webhooks.controller.ts`

```typescript
import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhooksService } from '../services/webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks/toss')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * 토스페이먼츠 웹훅 수신 엔드포인트
   * - 가상계좌 입금 완료
   * - 결제 취소 완료
   * - 결제 실패
   */
  @Post('payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '토스페이먼츠 웹훅 수신' })
  async handleTossPaymentWebhook(@Body() webhookData: any) {
    this.logger.log(`토스 웹훅 수신: ${JSON.stringify(webhookData)}`);

    try {
      // 웹훅 데이터 처리
      await this.webhooksService.handleTossWebhook(webhookData);

      // 토스에게 200 OK 응답 (필수!)
      return { success: true };
    } catch (error) {
      this.logger.error(`토스 웹훅 처리 실패: ${error.message}`);

      // 에러가 발생해도 200 OK 반환 (토스 재시도 방지)
      return { success: false, error: error.message };
    }
  }
}
```

### 3.2 서비스 구현

**파일**: `src/shop/services/webhooks.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 토스페이먼츠 웹훅 처리
   */
  async handleTossWebhook(webhookData: any) {
    const { eventType, data } = webhookData;

    this.logger.log(`웹훅 이벤트 타입: ${eventType}`);

    switch (eventType) {
      case 'Payment.Approved':
        await this.handlePaymentApproved(data);
        break;

      case 'Payment.Canceled':
        await this.handlePaymentCanceled(data);
        break;

      case 'Payment.Failed':
        await this.handlePaymentFailed(data);
        break;

      default:
        this.logger.warn(`알 수 없는 웹훅 이벤트: ${eventType}`);
    }
  }

  /**
   * 결제 승인 완료 처리 (가상계좌 입금 등)
   */
  private async handlePaymentApproved(data: any) {
    const { paymentKey, orderId, orderName, amount, method } = data;

    this.logger.log(`결제 승인 완료: ${orderId}, 금액: ${amount}원, 방식: ${method}`);

    // DB에서 주문 찾기
    const order = await this.prisma.orders.findFirst({
      where: { orderNumber: orderId },
    });

    if (!order) {
      this.logger.error(`주문을 찾을 수 없음: ${orderId}`);
      return;
    }

    // 이미 처리된 결제인지 확인 (중복 방지)
    if (order.status === 'PAID') {
      this.logger.warn(`이미 처리된 주문: ${orderId}`);
      return;
    }

    // 주문 상태 업데이트
    await this.prisma.orders.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        updatedAt: new Date(),
      },
    });

    // 결제 정보 저장
    await this.prisma.payments.create({
      data: {
        orderId: order.id,
        pgTransactionId: paymentKey,
        amount: amount,
        method: method,
        status: 'COMPLETED',
        approvedAt: new Date(),
      },
    });

    this.logger.log(`주문 상태 업데이트 완료: ${orderId} → PAID`);
  }

  /**
   * 결제 취소 완료 처리
   */
  private async handlePaymentCanceled(data: any) {
    const { paymentKey, orderId, cancelReason } = data;

    this.logger.log(`결제 취소 완료: ${orderId}, 사유: ${cancelReason}`);

    // 주문 상태 업데이트
    const order = await this.prisma.orders.findFirst({
      where: { orderNumber: orderId },
    });

    if (order) {
      await this.prisma.orders.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * 결제 실패 처리
   */
  private async handlePaymentFailed(data: any) {
    const { orderId, failReason } = data;

    this.logger.error(`결제 실패: ${orderId}, 사유: ${failReason}`);

    // 주문 상태 업데이트
    const order = await this.prisma.orders.findFirst({
      where: { orderNumber: orderId },
    });

    if (order) {
      await this.prisma.orders.update({
        where: { id: order.id },
        data: {
          status: 'PAYMENT_FAILED',
          updatedAt: new Date(),
        },
      });
    }
  }
}
```

### 3.3 모듈 등록

**파일**: `src/shop/payment.module.ts` (기존 파일 수정)

```typescript
import { Module } from '@nestjs/common';
import { WebhooksController } from './controllers/webhooks.controller';
import { WebhooksService } from './services/webhooks.service';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class PaymentModule {}
```

---

## 4. 웹훅 검증 (보안)

### 4.1 왜 검증이 필요한가?

누군가 우리 웹훅 URL을 알고 **가짜 데이터**를 보낼 수 있습니다!

```
해커 → POST /webhooks/toss/payment
{
  "eventType": "Payment.Approved",
  "data": {
    "orderId": "ORD123456",
    "amount": 1000000  // 가짜로 100만원 입금됐다고 속임
  }
}
```

### 4.2 서명 검증 (추천)

토스페이먼츠는 웹훅 요청에 **서명(Signature)**을 포함합니다.

**헤더 예시**:
```
Toss-Signature: sha256=abc123def456...
```

**검증 코드**:

```typescript
import * as crypto from 'crypto';

function verifyTossSignature(payload: string, signature: string, secretKey: string): boolean {
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  return `sha256=${hash}` === signature;
}

// 컨트롤러에서 사용
@Post('payment')
async handleTossPaymentWebhook(
  @Body() webhookData: any,
  @Headers('Toss-Signature') signature: string,
  @Req() req: Request,
) {
  // 원본 Body를 문자열로 가져오기
  const rawBody = JSON.stringify(webhookData);

  // 서명 검증
  const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
  const isValid = verifyTossSignature(rawBody, signature, secretKey);

  if (!isValid) {
    this.logger.error('토스 웹훅 서명 검증 실패!');
    throw new UnauthorizedException('Invalid signature');
  }

  // 검증 성공 시 처리
  await this.webhooksService.handleTossWebhook(webhookData);
  return { success: true };
}
```

### 4.3 IP 화이트리스트 (선택)

토스페이먼츠 서버 IP만 허용:

```typescript
const TOSS_IPS = [
  '211.33.136.0/24',   // 토스 IP 대역 (예시)
  '211.33.137.0/24',
];

function isTossIP(clientIP: string): boolean {
  // IP 대역 검증 로직
  return TOSS_IPS.some(range => isIPInRange(clientIP, range));
}
```

---

## 5. 테스트 방법

### 5.1 로컬 테스트 (curl)

```bash
curl -X POST http://localhost:10804/webhooks/toss/payment \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "Payment.Approved",
    "data": {
      "paymentKey": "test_payment_key_123",
      "orderId": "ORD20251110123456",
      "orderName": "바이브코딩 상품",
      "amount": 15000,
      "method": "가상계좌"
    }
  }'
```

### 5.2 토스 개발자센터에서 테스트

1. 토스 개발자센터 → 내 앱 → 웹훅 탭
2. "웹훅 테스트 전송" 버튼 클릭
3. 이벤트 선택: `Payment.Approved`
4. 전송 → 우리 서버 로그 확인

### 5.3 실제 결제로 테스트

1. 앱에서 **가상계좌 결제** 시도
2. 가상계좌 번호 발급받기
3. 테스트 환경에서는 토스 개발자센터에서 **입금 완료 처리** 가능
4. 웹훅 호출 확인

---

## 6. 주의사항

### 6.1 반드시 200 OK 응답

웹훅 엔드포인트는 **항상 200 OK**를 반환해야 합니다.
- 에러가 나도 200 반환
- 그렇지 않으면 토스가 계속 재시도 (최대 10번)

```typescript
try {
  await this.webhooksService.handleTossWebhook(webhookData);
  return { success: true };
} catch (error) {
  this.logger.error(error);
  // 에러가 나도 200 반환
  return { success: false, error: error.message };
}
```

### 6.2 멱등성 보장

같은 웹훅이 여러 번 올 수 있습니다.
- 이미 처리된 건인지 확인
- 중복 처리 방지

```typescript
if (order.status === 'PAID') {
  this.logger.warn(`이미 처리된 주문: ${orderId}`);
  return;
}
```

### 6.3 타임아웃 설정

웹훅 처리는 **30초 이내**에 완료해야 합니다.
- 무거운 작업은 큐(Queue)로 비동기 처리

---

## 7. 운영 체크리스트

배포 전 확인 사항:

- [ ] 토스 개발자센터에 웹훅 URL 등록 완료
- [ ] 웹훅 엔드포인트 구현 완료
- [ ] 서명 검증 로직 구현 완료
- [ ] 중복 처리 방지 로직 추가
- [ ] 에러 발생 시에도 200 OK 반환
- [ ] 웹훅 수신 로그 남기기
- [ ] 테스트 환경에서 테스트 완료

---

## 8. 트러블슈팅

### Q1. 웹훅이 안 오는데요?
- 토스 개발자센터에서 URL 확인
- HTTPS 사용 여부 확인 (로컬은 HTTP 가능)
- 서버가 외부에서 접근 가능한지 확인

### Q2. 웹훅이 중복으로 오는데요?
- 정상입니다. 멱등성 보장 로직으로 처리하세요.

### Q3. 웹훅 서명 검증이 계속 실패하는데요?
- Secret Key 확인
- Raw Body를 정확히 사용하는지 확인
- Body Parser 설정 확인

---

**작성자**: Claude (AI Assistant)
**참고 문서**: https://docs.tosspayments.com/guides/webhook
