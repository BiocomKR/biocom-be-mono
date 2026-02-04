# 📱 앱 개발자를 위한 토스페이먼츠 연동 가이드

> **작성일**: 2025-11-10
> **대상**: 바이브코딩 앱(Flutter/React Native) 개발자
> **목적**: 토스페이먼츠 결제 연동 완벽 가이드

---

## 📋 목차
1. [결제 방식별 플로우 이해](#1-결제-방식별-플로우-이해)
2. [전체 결제 플로우](#2-전체-결제-플로우)
3. [토스 SDK 설치 및 설정](#3-토스-sdk-설치-및-설정)
4. [결제 요청 구현](#4-결제-요청-구현)
5. [결제 승인 API 호출](#5-결제-승인-api-호출)
6. [구독 결제 구현 (빌링키)](#6-구독-결제-구현-빌링키)
7. [에러 처리](#7-에러-처리)
8. [테스트 방법](#8-테스트-방법)

---

## 1. 결제 방식별 플로우 이해

### ⚡ 중요: 카드 결제 vs 가상계좌 결제

토스페이먼츠는 **결제 방식에 따라 플로우가 다릅니다!**

### 1.1 카드 결제 (즉시 결제)

```
┌─────────┐
│   앱    │
└────┬────┘
     │ 1. 결제하기 클릭
     ↓
┌────────────────────┐
│ 토스 결제창 (카드)  │
└────┬───────────────┘
     │ 2. 카드 정보 입력 → 즉시 결제 완료
     ↓
┌─────────────────────────┐
│ paymentKey 받음          │
│ (결제 이미 완료된 상태!) │
└────┬────────────────────┘
     │ 3. 앱 → 백엔드 /payment/confirm 호출
     ↓
┌──────────────────────┐
│ 백엔드가 토스에 검증  │
│ → DB 저장            │
│ → status: PAID       │
└──────────────────────┘
```

**핵심**: `/payment/confirm`을 **앱이 호출**합니다!

---

### 1.2 가상계좌 결제 (입금 대기)

```
┌─────────┐
│   앱    │
└────┬────┘
     │ 1. 결제하기 클릭
     ↓
┌──────────────────────┐
│ 토스 결제창 (가상계좌) │
└────┬─────────────────┘
     │ 2. 가상계좌 번호 발급 (아직 입금 안 됨!)
     ↓
┌─────────────────────────────┐
│ 가상계좌 정보:               │
│ - 은행: 우리은행              │
│ - 계좌: 1002-123-456789      │
│ - 입금자명: 홍길동            │
└────┬────────────────────────┘
     │ 3. 앱 → 백엔드 /payment/confirm 호출
     ↓
┌──────────────────────┐
│ 백엔드가 토스에 검증  │
│ → DB 저장            │
│ → status: PENDING ⚠️ │
│   (입금 대기 상태)    │
└──────────────────────┘
     │
     │ 4. 사용자가 은행 앱에서 입금
     ↓
┌─────────────────┐
│ 토스 서버       │
│ (입금 확인!)    │
└────┬────────────┘
     │ 5. 토스 → 백엔드 /webhooks/toss/payment 호출 (웹훅!)
     ↓
┌──────────────────────┐
│ 백엔드 웹훅 처리      │
│ → DB 업데이트        │
│ → status: PAID ✅    │
└──────────────────────┘
```

**핵심**:
- `/payment/confirm`은 **앱이 호출** (가상계좌 번호 발급 확인용)
- `/webhooks/toss/payment`은 **토스가 호출** (입금 완료 통보용)

---

### 1.3 두 엔드포인트의 역할 비교

| 엔드포인트 | 누가 호출? | 언제? | 용도 |
|-----------|----------|------|------|
| `/payment/confirm` | **앱** | 토스 결제창 완료 직후 | 카드 즉시 결제 확인, 가상계좌 발급 확인 |
| `/webhooks/toss/payment` | **토스** | 가상계좌 입금 완료 시 | 입금 완료 통보 (백엔드만 알아야 함) |

**앱 개발자는 `/payment/confirm`만 호출하면 됩니다!**
웹훅은 백엔드가 알아서 처리합니다.

---

## 2. 전체 결제 플로우

```
┌─────────────┐
│   앱(사용자)  │
└──────┬──────┘
       │ 1. 결제하기 버튼 클릭
       ↓
┌─────────────────────────────────┐
│  백엔드 API: POST /shop/orders  │
│  주문 생성 + paymentKey 발급    │
└────────────┬────────────────────┘
             │ 2. orderId, amount, orderName 리턴
             ↓
┌─────────────────────────────────┐
│  토스 결제창 SDK 호출            │
│  - clientKey 사용               │
│  - orderId, amount 전달         │
└────────────┬────────────────────┘
             │ 3. 사용자 카드정보 입력
             ↓
┌─────────────────────────────────┐
│  토스 서버로 결제 요청           │
└────────────┬────────────────────┘
             │ 4. 결제 성공/실패
             ↓
┌─────────────────────────────────┐
│  앱으로 리턴:                    │
│  - paymentKey (토스가 발급)     │
│  - orderId                      │
│  - amount                       │
└────────────┬────────────────────┘
             │ 5. 백엔드로 결제 승인 요청
             ↓
┌──────────────────────────────────────┐
│  백엔드 API: POST /shop/payment/confirm │
│  {                                    │
│    "paymentKey": "...",               │
│    "orderId": "...",                  │
│    "amount": 15000                    │
│  }                                    │
└────────────┬─────────────────────────┘
             │ 6. 토스 API로 검증
             ↓
┌─────────────────────────────────┐
│  백엔드 → 토스 API 호출          │
│  POST /v1/payments/confirm      │
└────────────┬────────────────────┘
             │ 7. 검증 완료
             ↓
┌─────────────────────────────────┐
│  DB 저장:                        │
│  - orders 테이블 status 업데이트 │
│  - payments 테이블 저장          │
└────────────┬────────────────────┘
             │ 8. 결제 완료 응답
             ↓
┌─────────────┐
│  앱: 완료 화면 │
└─────────────┘
```

---

## 2. 토스 SDK 설치 및 설정

### 2.1 Flutter 기준

#### 의존성 추가 (`pubspec.yaml`)
```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0  # API 호출용
  # 토스페이먼츠 공식 패키지는 없으므로 WebView 사용
  webview_flutter: ^4.4.2
```

#### iOS 설정 (`ios/Runner/Info.plist`)
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

#### Android 설정 (`android/app/src/main/AndroidManifest.xml`)
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

### 2.2 React Native 기준

#### 의존성 추가
```bash
npm install @tosspayments/payment-sdk
# 또는
yarn add @tosspayments/payment-sdk
```

---

## 3. 결제 요청 구현

### 3.1 주문 생성 API 호출

**엔드포인트**: `POST /shop/orders`

**요청 예시**:
```json
{
  "products": [
    {
      "productId": 1,
      "quantity": 2
    }
  ],
  "recipientName": "홍길동",
  "recipientPhone": "01012345678",
  "address": "서울시 강남구 테헤란로 123",
  "addressDetail": "456호",
  "zipCode": "06234",
  "shippingMemo": "문 앞에 놔주세요",
  "usedPoints": 1000,
  "couponId": 5
}
```

**응답 예시**:
```json
{
  "success": true,
  "data": {
    "orderNumber": "ORD20251110123456",
    "orderId": "order_abc123def456",  // 토스 결제에 사용할 ID
    "amount": 15000,                   // 최종 결제 금액
    "orderName": "바이브코딩 상품 외 1건"  // 주문명
  }
}
```

### 3.2 토스 결제창 호출

#### Flutter 예시 (WebView 방식)

```dart
import 'package:webview_flutter/webview_flutter.dart';

class TossPaymentScreen extends StatefulWidget {
  final String orderId;
  final int amount;
  final String orderName;

  const TossPaymentScreen({
    required this.orderId,
    required this.amount,
    required this.orderName,
  });

  @override
  _TossPaymentScreenState createState() => _TossPaymentScreenState();
}

class _TossPaymentScreenState extends State<TossPaymentScreen> {
  late final WebViewController _controller;

  // 토스페이먼츠 클라이언트 키 (백엔드에서 받아오거나 환경변수로 관리)
  final String clientKey = 'test_ck_0RnYX2w532qNWYYLpqXP8NeyqApQ';
  final String successUrl = 'https://api-dev.biocom.ai.kr/payment/success';
  final String failUrl = 'https://api-dev.biocom.ai.kr/payment/fail';

  @override
  void initState() {
    super.initState();

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (NavigationRequest request) {
            // 결제 성공 콜백
            if (request.url.startsWith(successUrl)) {
              _handlePaymentSuccess(request.url);
              return NavigationDecision.prevent;
            }
            // 결제 실패 콜백
            if (request.url.startsWith(failUrl)) {
              _handlePaymentFail(request.url);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadHtmlString(_getPaymentHtml());
  }

  String _getPaymentHtml() {
    return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>토스페이먼츠 결제</title>
    <script src="https://js.tosspayments.com/v1/payment"></script>
</head>
<body>
    <script>
        const clientKey = '$clientKey';
        const tossPayments = TossPayments(clientKey);

        tossPayments.requestPayment('카드', {
            amount: ${widget.amount},
            orderId: '${widget.orderId}',
            orderName: '${widget.orderName}',
            customerName: '고객명',
            successUrl: '$successUrl',
            failUrl: '$failUrl',
        }).catch(function (error) {
            if (error.code === 'USER_CANCEL') {
                window.location.href = '$failUrl?code=USER_CANCEL&message=사용자가 결제를 취소했습니다';
            }
        });
    </script>
</body>
</html>
    ''';
  }

  void _handlePaymentSuccess(String url) {
    final uri = Uri.parse(url);
    final paymentKey = uri.queryParameters['paymentKey'];
    final orderId = uri.queryParameters['orderId'];
    final amount = uri.queryParameters['amount'];

    // 백엔드 결제 승인 API 호출
    _confirmPayment(paymentKey!, orderId!, amount!);
  }

  void _handlePaymentFail(String url) {
    final uri = Uri.parse(url);
    final code = uri.queryParameters['code'];
    final message = uri.queryParameters['message'];

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('결제 실패: $message')),
    );
  }

  Future<void> _confirmPayment(String paymentKey, String orderId, String amount) async {
    // 다음 섹션에서 설명
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('결제하기')),
      body: WebViewWidget(controller: _controller),
    );
  }
}
```

#### React Native 예시

```typescript
import { TossPayments } from '@tosspayments/payment-sdk';

const clientKey = 'test_ck_0RnYX2w532qNWYYLpqXP8NeyqApQ';

async function requestPayment(orderId: string, amount: number, orderName: string) {
  const tossPayments = TossPayments(clientKey);

  try {
    await tossPayments.requestPayment('카드', {
      amount: amount,
      orderId: orderId,
      orderName: orderName,
      customerName: '고객명',
      successUrl: 'https://api-dev.biocom.ai.kr/payment/success',
      failUrl: 'https://api-dev.biocom.ai.kr/payment/fail',
    });
  } catch (error) {
    if (error.code === 'USER_CANCEL') {
      console.log('사용자가 결제를 취소했습니다.');
    } else {
      console.error('결제 오류:', error);
    }
  }
}
```

---

## 4. 결제 승인 API 호출

### 4.1 백엔드 API 호출

**엔드포인트**: `POST /shop/payment/confirm`

**요청 헤더**:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**요청 Body**:
```json
{
  "paymentKey": "5zJ4xY7m0kODnyRpQWGrN2xqGlNvLrKwv1M9ENjbeoPaZdL6",
  "orderId": "order_abc123def456",
  "amount": 15000
}
```

**응답 예시** (성공):
```json
{
  "success": true,
  "data": {
    "orderNumber": "ORD20251110123456",
    "status": "PAID",
    "amount": 15000,
    "paymentMethod": "카드",
    "approvedAt": "2025-11-10T14:30:00+09:00"
  }
}
```

**응답 예시** (실패):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_AMOUNT",
    "message": "결제 금액이 일치하지 않습니다"
  }
}
```

### 4.2 Flutter 구현 예시

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<void> _confirmPayment(String paymentKey, String orderId, String amount) async {
  final url = Uri.parse('https://api-dev.biocom.ai.kr/shop/payment/confirm');

  try {
    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer ${yourAccessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'paymentKey': paymentKey,
        'orderId': orderId,
        'amount': int.parse(amount),
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);

      if (data['success'] == true) {
        // 결제 성공 처리
        Navigator.pop(context);
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => PaymentSuccessScreen(
              orderNumber: data['data']['orderNumber'],
            ),
          ),
        );
      } else {
        throw Exception(data['error']['message']);
      }
    } else {
      throw Exception('결제 승인 실패: ${response.statusCode}');
    }
  } catch (e) {
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('결제 승인 중 오류: $e')),
    );
  }
}
```

---

## 6. 구독 결제 구현 (빌링키)

### 6.1 구독 결제 플로우 이해

**구독 결제**는 사용자가 **한 번 카드를 등록**하면, 매달 자동으로 결제되는 시스템입니다.

```
┌────────────────────────────────────────────────────────────┐
│                  1. 빌링키 발급 단계                        │
└────────────────────────────────────────────────────────────┘

앱 → 토스 결제창 (카드 등록용)
  → 토스 서버 (authKey 발급)
  → 앱 → 백엔드 /shop/subscription/billing
  → 백엔드 → 토스 API (빌링키 발급)
  → DB 저장 (billingKey)

┌────────────────────────────────────────────────────────────┐
│                  2. 구독 생성 (첫 결제)                     │
└────────────────────────────────────────────────────────────┘

앱 → 백엔드 /shop/subscription (구독 상품 선택)
  → 백엔드 → 토스 API (빌링키로 즉시 결제)
  → 성공 시 구독 생성 (next_billing_date = 30일 후)

┌────────────────────────────────────────────────────────────┐
│                  3. 자동 결제 (매달)                        │
└────────────────────────────────────────────────────────────┘

매일 자정 00:00 크론잡 실행
  → next_billing_date가 오늘인 구독 찾기
  → 토스 API (빌링키로 자동 결제)
  → 성공 시 next_billing_date += 30일
```

**핵심**:
- 사용자는 **카드를 한 번만 등록** (빌링키 발급)
- 이후 백엔드가 **자동으로 결제** (사용자 액션 불필요)
- 앱은 **빌링키 등록**과 **구독 생성**만 구현하면 됨

---

### 6.2 빌링키 등록 구현

#### Step 1: 토스 결제창 호출 (카드 등록용)

```dart
import 'package:webview_flutter/webview_flutter.dart';

class RegisterBillingKeyScreen extends StatefulWidget {
  final String customerKey; // "user_{userId}" 형식

  const RegisterBillingKeyScreen({required this.customerKey});

  @override
  _RegisterBillingKeyScreenState createState() => _RegisterBillingKeyScreenState();
}

class _RegisterBillingKeyScreenState extends State<RegisterBillingKeyScreen> {
  late final WebViewController _controller;

  final String clientKey = 'test_ck_0RnYX2w532qNWYYLpqXP8NeyqApQ';
  final String successUrl = 'https://api-dev.biocom.ai.kr/billing/success';
  final String failUrl = 'https://api-dev.biocom.ai.kr/billing/fail';

  @override
  void initState() {
    super.initState();

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (NavigationRequest request) {
            if (request.url.startsWith(successUrl)) {
              _handleSuccess(request.url);
              return NavigationDecision.prevent;
            }
            if (request.url.startsWith(failUrl)) {
              _handleFail(request.url);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadHtmlString(_getBillingKeyHtml());
  }

  String _getBillingKeyHtml() {
    return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>카드 등록</title>
    <script src="https://js.tosspayments.com/v1/payment"></script>
</head>
<body>
    <script>
        const clientKey = '$clientKey';
        const tossPayments = TossPayments(clientKey);

        // 빌링키 발급용 결제창 (실제 결제는 안 됨!)
        tossPayments.requestBillingAuth('카드', {
            customerKey: '${widget.customerKey}',
            successUrl: '$successUrl',
            failUrl: '$failUrl',
        }).catch(function (error) {
            if (error.code === 'USER_CANCEL') {
                window.location.href = '$failUrl?code=USER_CANCEL&message=카드 등록을 취소했습니다';
            }
        });
    </script>
</body>
</html>
    ''';
  }

  void _handleSuccess(String url) {
    final uri = Uri.parse(url);
    final authKey = uri.queryParameters['authKey'];
    final customerKey = uri.queryParameters['customerKey'];

    // 백엔드에 빌링키 발급 요청
    _registerBillingKey(authKey!, customerKey!);
  }

  void _handleFail(String url) {
    final uri = Uri.parse(url);
    final message = uri.queryParameters['message'];

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('카드 등록 실패: $message')),
    );
  }

  Future<void> _registerBillingKey(String authKey, String customerKey) async {
    final url = Uri.parse('https://api-dev.biocom.ai.kr/shop/subscription/billing');

    try {
      final response = await http.post(
        url,
        headers: {
          'Authorization': 'Bearer ${yourAccessToken}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'authKey': authKey,
          'customerKey': customerKey,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);

        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('카드가 등록되었습니다: ${data['card']['company']} ${data['card']['number']}')),
        );
      } else {
        throw Exception('빌링키 등록 실패');
      }
    } catch (e) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('카드 등록 중 오류: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('카드 등록')),
      body: WebViewWidget(controller: _controller),
    );
  }
}
```

#### Step 2: 백엔드 API 호출

**엔드포인트**: `POST /shop/subscription/billing`

**요청**:
```json
{
  "authKey": "토스에서_받은_authKey",
  "customerKey": "user_123"
}
```

**응답**:
```json
{
  "billingKey": "BIL20250110xxxxxx",
  "customerKey": "user_123",
  "card": {
    "company": "신한",
    "number": "1234",
    "cardType": "신용"
  }
}
```

---

### 6.3 구독 생성 구현

사용자가 구독 상품을 선택하고 "구독하기" 버튼을 누르면, 백엔드에 구독 생성 요청을 보냅니다.

```dart
Future<void> createSubscription(int productId) async {
  final url = Uri.parse('https://api-dev.biocom.ai.kr/shop/subscription');

  try {
    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer ${yourAccessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'productId': productId,
        'billingCycle': 30, // 선택사항, 기본값 30일
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('구독이 시작되었습니다!')),
      );

      // 구독 정보 화면으로 이동
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => SubscriptionDetailScreen(
            subscriptionId: data['id'],
          ),
        ),
      );
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['error']['message']);
    }
  } catch (e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('구독 생성 실패: $e')),
    );
  }
}
```

**주의**:
- 구독 생성 시 **즉시 첫 결제가 실행**됩니다!
- 빌링키가 없으면 에러가 발생합니다.
- 결제 실패 시 구독이 생성되지 않습니다.

---

### 6.4 내 구독 목록 조회

```dart
Future<List<Subscription>> getMySubscriptions() async {
  final url = Uri.parse('https://api-dev.biocom.ai.kr/shop/subscription');

  final response = await http.get(
    url,
    headers: {
      'Authorization': 'Bearer ${yourAccessToken}',
    },
  );

  if (response.statusCode == 200) {
    final List<dynamic> data = jsonDecode(response.body);
    return data.map((json) => Subscription.fromJson(json)).toList();
  } else {
    throw Exception('구독 목록 조회 실패');
  }
}
```

**응답 예시**:
```json
[
  {
    "id": 1,
    "status": "ACTIVE",
    "startDate": "2025-01-10T00:00:00.000Z",
    "nextBillingDate": "2025-02-09T00:00:00.000Z",
    "price": 99000,
    "product": {
      "id": 1,
      "name": "바이브코딩 프리미엄"
    }
  }
]
```

---

### 6.5 구독 취소 구현

```dart
Future<void> cancelSubscription(int subscriptionId) async {
  final url = Uri.parse('https://api-dev.biocom.ai.kr/shop/subscription/$subscriptionId');

  try {
    final response = await http.delete(
      url,
      headers: {
        'Authorization': 'Bearer ${yourAccessToken}',
      },
    );

    if (response.statusCode == 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('구독이 취소되었습니다')),
      );
    } else {
      throw Exception('구독 취소 실패');
    }
  } catch (e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('구독 취소 중 오류: $e')),
    );
  }
}
```

---

### 6.6 구독 일시정지/재개

```dart
// 일시정지
Future<void> pauseSubscription(int subscriptionId) async {
  final url = Uri.parse('https://api-dev.biocom.ai.kr/shop/subscription/$subscriptionId/pause');

  final response = await http.patch(
    url,
    headers: {'Authorization': 'Bearer ${yourAccessToken}'},
  );

  if (response.statusCode == 200) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('구독이 일시정지되었습니다')),
    );
  }
}

// 재개
Future<void> resumeSubscription(int subscriptionId) async {
  final url = Uri.parse('https://api-dev.biocom.ai.kr/shop/subscription/$subscriptionId/resume');

  final response = await http.patch(
    url,
    headers: {'Authorization': 'Bearer ${yourAccessToken}'},
  );

  if (response.statusCode == 200) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('구독이 재개되었습니다')),
    );
  }
}
```

---

### 6.7 빌링키 삭제 (카드 삭제)

사용자가 등록한 카드를 삭제하고 싶을 때:

```dart
Future<void> deleteBillingKey() async {
  final url = Uri.parse('https://api-dev.biocom.ai.kr/shop/subscription/billing');

  try {
    final response = await http.delete(
      url,
      headers: {'Authorization': 'Bearer ${yourAccessToken}'},
    );

    if (response.statusCode == 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('카드가 삭제되었습니다')),
      );
    }
  } catch (e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('카드 삭제 중 오류: $e')),
    );
  }
}
```

**주의**:
- 빌링키 삭제 시 **모든 활성 구독이 자동 취소**됩니다!
- 사용자에게 확인 다이얼로그를 먼저 보여주세요.

---

### 6.8 구독 UI 예시

#### 구독 상태 배지 표시

```dart
Widget buildSubscriptionStatusBadge(String status) {
  Color color;
  String label;

  switch (status) {
    case 'ACTIVE':
      color = Colors.green;
      label = '활성';
      break;
    case 'PAUSED':
      color = Colors.orange;
      label = '일시정지';
      break;
    case 'CANCELED':
      color = Colors.red;
      label = '취소됨';
      break;
    case 'PAYMENT_FAILED':
      color = Colors.red;
      label = '결제 실패';
      break;
    default:
      color = Colors.grey;
      label = status;
  }

  return Container(
    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: color.withOpacity(0.2),
      borderRadius: BorderRadius.circular(4),
      border: Border.all(color: color),
    ),
    child: Text(
      label,
      style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold),
    ),
  );
}
```

#### 다음 결제일 표시

```dart
Widget buildNextBillingDate(DateTime nextBillingDate) {
  final daysLeft = nextBillingDate.difference(DateTime.now()).inDays;

  return Row(
    children: [
      Icon(Icons.calendar_today, size: 16, color: Colors.grey),
      SizedBox(width: 4),
      Text(
        '다음 결제일: ${DateFormat('yyyy-MM-dd').format(nextBillingDate)}',
        style: TextStyle(fontSize: 14, color: Colors.grey[700]),
      ),
      SizedBox(width: 8),
      Text(
        '(D-$daysLeft)',
        style: TextStyle(fontSize: 12, color: Colors.orange, fontWeight: FontWeight.bold),
      ),
    ],
  );
}
```

---

### 6.9 구독 API 엔드포인트 정리

| 기능 | 메서드 | 엔드포인트 | 설명 |
|-----|--------|-----------|------|
| 빌링키 등록 | POST | `/shop/subscription/billing` | 카드 등록 (한 번만) |
| 빌링키 삭제 | DELETE | `/shop/subscription/billing` | 카드 삭제 (모든 구독 취소) |
| 구독 생성 | POST | `/shop/subscription` | 구독 시작 (첫 결제 즉시) |
| 내 구독 목록 | GET | `/shop/subscription` | 구독 목록 조회 |
| 구독 상세 | GET | `/shop/subscription/:id` | 구독 상세 정보 |
| 구독 취소 | DELETE | `/shop/subscription/:id` | 구독 취소 |
| 구독 일시정지 | PATCH | `/shop/subscription/:id/pause` | 일시정지 |
| 구독 재개 | PATCH | `/shop/subscription/:id/resume` | 재개 |

---

### 6.10 구독 결제 FAQ

#### Q1. 빌링키 발급 시 실제로 결제가 되나요?
❌ **아니요!** 빌링키 발급은 **카드 정보만 등록**하는 것입니다. 실제 결제는 구독 생성 시에만 발생합니다.

#### Q2. 구독 생성 시 언제 결제가 되나요?
✅ **즉시 결제**됩니다! 구독 생성 API 호출 시 첫 결제가 바로 실행되고, 성공해야만 구독이 생성됩니다.

#### Q3. 두 번째 결제부터는 어떻게 되나요?
✅ 백엔드가 **자동으로 처리**합니다. 매일 자정 00:00(KST)에 `next_billing_date`가 도래한 구독들을 자동 결제합니다. 앱은 아무것도 할 필요 없습니다.

#### Q4. 사용자가 토스 앱에서 카드를 삭제하면?
✅ 토스에서 백엔드로 **웹훅**을 보내고, 백엔드가 자동으로 모든 구독을 취소합니다. 앱에서는 다음에 구독 목록을 조회할 때 상태가 `BILLING_DELETED`로 보입니다.

#### Q5. 결제 실패 시 어떻게 되나요?
✅ 구독 상태가 `PAYMENT_FAILED`로 변경되고, 다음 자동결제는 실행되지 않습니다. 사용자에게 알림을 보내서 카드 정보를 확인하도록 안내해야 합니다.

#### Q6. 일시정지하면 결제가 어떻게 되나요?
✅ 일시정지된 구독은 자동결제가 실행되지 않습니다. 재개하면 다시 정상적으로 자동결제가 진행됩니다.

---

## 7. 에러 처리

### 7.1 주요 에러 코드

| 에러 코드 | 설명 | 처리 방법 |
|----------|------|----------|
| `USER_CANCEL` | 사용자가 결제창 닫음 | 주문 화면으로 복귀 |
| `INVALID_CARD_NUMBER` | 잘못된 카드 번호 | 다시 입력 유도 |
| `INVALID_EXPIRATION` | 유효기간 오류 | 다시 입력 유도 |
| `EXCEED_MAX_CARD_INSTALLMENT_PLAN` | 할부 개월 초과 | 할부 개월 조정 |
| `INVALID_AMOUNT` | 금액 불일치 | 주문 다시 생성 |
| `NOT_FOUND_PAYMENT` | 결제 정보 없음 | 고객센터 안내 |

### 5.2 에러 처리 예시

```dart
void _handlePaymentError(dynamic error) {
  String message = '결제 중 오류가 발생했습니다.';

  if (error.code == 'USER_CANCEL') {
    message = '결제가 취소되었습니다.';
  } else if (error.code == 'INVALID_CARD_NUMBER') {
    message = '카드 번호를 확인해주세요.';
  } else if (error.code == 'INVALID_AMOUNT') {
    message = '결제 금액이 변경되었습니다. 다시 시도해주세요.';
  }

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('결제 실패'),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('확인'),
        ),
      ],
    ),
  );
}
```

---

## 8. 테스트 방법

### 8.1 테스트 카드 정보

토스페이먼츠 테스트 환경에서 사용 가능한 카드:

| 카드사 | 카드번호 | 유효기간 | CVC |
|-------|---------|---------|-----|
| 신한카드 | 9446-0177-7172-0368 | 아무거나 | 아무거나 |
| KB국민카드 | 9430-0177-7172-0368 | 아무거나 | 아무거나 |
| 현대카드 | 9446-0177-7172-0368 | 아무거나 | 아무거나 |

> **주의**: 실제 카드 번호를 입력하지 마세요! 테스트 환경에서는 위 카드만 사용 가능합니다.

### 8.2 테스트 시나리오

#### ✅ 정상 결제 플로우
1. 앱에서 상품 선택 후 주문하기
2. 주문 생성 API 호출 → `orderId`, `amount` 받기
3. 토스 결제창 호출
4. 테스트 카드로 결제
5. `paymentKey` 받아서 결제 승인 API 호출
6. 결제 완료 화면 표시

#### ❌ 결제 취소 플로우
1. 토스 결제창에서 뒤로가기 버튼 클릭
2. `USER_CANCEL` 에러 처리
3. 주문 화면으로 복귀

#### ❌ 금액 변조 방지
1. 앱에서 `amount`를 임의로 수정
2. 결제 승인 API에서 `INVALID_AMOUNT` 에러 반환
3. 에러 메시지 표시

---

## 7. 보안 주의사항

### 7.1 절대 하지 말아야 할 것

❌ **Client Key를 앱에 하드코딩**
```dart
// 나쁜 예
final String clientKey = 'test_ck_0RnYX2w532qNWYYLpqXP8NeyqApQ';
```

✅ **환경변수나 백엔드에서 받아오기**
```dart
// 좋은 예
final clientKey = await _fetchClientKeyFromBackend();
```

❌ **Secret Key를 앱에 절대 포함하지 말 것**
- Secret Key는 오직 백엔드에서만 사용!

### 7.2 금액 검증

- 앱에서 계산한 금액을 믿지 말 것
- 반드시 백엔드에서 재계산한 금액으로 검증
- 토스 결제 승인 시 금액 일치 여부 확인

---

## 8. API 엔드포인트 정리

| 기능 | 메서드 | 엔드포인트 | 설명 |
|-----|--------|-----------|------|
| 주문 생성 | POST | `/shop/orders` | 결제 전 주문 생성 |
| 결제 승인 | POST | `/shop/payment/confirm` | 토스 결제 검증 및 승인 |
| 결제 취소 | POST | `/shop/orders/{orderNumber}/cancel` | 주문 취소 |
| 주문 조회 | GET | `/shop/orders/{orderNumber}` | 주문 상세 조회 |

---

## 9. 자주 묻는 질문 (FAQ)

### Q1. 결제창이 안 뜨는데요?
- Client Key 확인
- 인터넷 권한 확인 (Android)
- JavaScript 활성화 확인 (WebView)

### Q2. 결제는 성공했는데 DB에 안 들어가요?
- 결제 승인 API(`/shop/payment/confirm`)를 호출했는지 확인
- 백엔드 로그 확인 필요

### Q3. 테스트 카드가 안 되는데요?
- 테스트 환경(Client Key가 `test_ck_`로 시작)인지 확인
- 운영 키를 사용하면 실제 카드만 가능

### Q4. 금액이 0원으로 표시되는데요?
- `amount`를 정수(int)로 전달했는지 확인
- 문자열로 보내면 안 됨

---

## 10. 연락처

문제가 발생하면 백엔드 개발팀에 문의하세요.

- **백엔드 API 문서**: https://api-dev.biocom.ai.kr/docs
- **토스페이먼츠 개발자 문서**: https://docs.tosspayments.com/

---

**작성자**: Claude (AI Assistant)
**검수자**: 백엔드 개발팀
