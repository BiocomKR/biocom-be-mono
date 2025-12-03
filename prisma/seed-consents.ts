import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const consentData = [
  {
    code: 'SERVICE_TERMS',
    title: '서비스 이용약관',
    content: `제1조 (목적)
이 약관은 바이오컴(이하 "회사")이 제공하는 서비스의 이용조건 및 절차, 회사와 이용자의 권리, 의무, 책임사항 등을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 모바일 애플리케이션 및 웹사이트를 통한 건강관리 서비스를 말합니다.
2. "이용자"란 이 약관에 따라 회사가 제공하는 서비스를 이용하는 회원을 말합니다.

제3조 (약관의 효력)
1. 이 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.
2. 회사는 필요한 경우 관련 법령을 위반하지 않는 범위에서 이 약관을 변경할 수 있습니다.`,
    version: '1.0',
    isRequired: true,
    isActive: true,
    displayOrder: 1,
  },
  {
    code: 'AGE_14',
    title: '만 14세 이상 확인',
    content: `본인은 만 14세 이상임을 확인합니다.

개인정보보호법에 따라 만 14세 미만 아동의 개인정보 수집 시 법정대리인의 동의가 필요합니다.

바이오컴 서비스는 만 14세 이상의 이용자를 대상으로 합니다.`,
    version: '1.0',
    isRequired: true,
    isActive: true,
    displayOrder: 2,
  },
  {
    code: 'PRIVACY',
    title: '개인정보 수집 및 이용 동의',
    content: `1. 수집하는 개인정보 항목
- 필수항목: 이름, 휴대폰번호, 생년월일, 성별
- 선택항목: 이메일, 건강정보

2. 개인정보의 수집 및 이용 목적
- 회원 가입 및 관리
- 서비스 제공 및 운영
- 맞춤형 건강 정보 제공
- 고객 상담 및 불만 처리

3. 개인정보의 보유 및 이용 기간
- 회원 탈퇴 시까지 (단, 관계 법령에 따라 보존이 필요한 경우 해당 기간까지)

4. 동의 거부권 및 불이익
- 이용자는 개인정보 수집에 동의하지 않을 권리가 있습니다.
- 다만, 필수항목에 대한 동의 거부 시 서비스 이용이 제한될 수 있습니다.`,
    version: '1.0',
    isRequired: true,
    isActive: true,
    displayOrder: 3,
  },
  {
    code: 'THIRD_PARTY',
    title: '제3자 정보 제공 동의',
    content: `1. 개인정보를 제공받는 자
- 배송업체 (CJ대한통운, 한진택배 등)
- 결제대행사 (토스페이먼츠)

2. 제공하는 개인정보 항목
- 배송: 이름, 휴대폰번호, 배송지 주소
- 결제: 결제 정보

3. 제공받는 자의 이용 목적
- 상품 배송 및 배송 조회
- 결제 처리 및 환불

4. 보유 및 이용 기간
- 배송 완료 후 3개월
- 전자상거래법에 따른 보존 기간

5. 동의 거부권
- 이용자는 제3자 제공에 동의하지 않을 권리가 있습니다.
- 다만, 동의 거부 시 상품 구매 서비스 이용이 제한될 수 있습니다.`,
    version: '1.0',
    isRequired: false,
    isActive: true,
    displayOrder: 4,
  },
  {
    code: 'MARKETING',
    title: '마케팅 정보 수신 동의',
    content: `1. 마케팅 정보 수신 동의
바이오컴의 신규 서비스, 이벤트, 프로모션 등 다양한 혜택 정보를 받아보실 수 있습니다.

2. 수신 채널
- 앱 푸시 알림
- SMS/MMS
- 이메일

3. 수신 정보 내용
- 신규 서비스 안내
- 할인 및 이벤트 정보
- 맞춤형 건강 정보 및 콘텐츠
- 설문조사 참여 안내

4. 동의 철회
- 마이페이지에서 언제든지 수신 동의를 철회할 수 있습니다.
- 수신 거부 시에도 서비스 이용에 필요한 필수 안내는 발송됩니다.`,
    version: '1.0',
    isRequired: false,
    isActive: true,
    displayOrder: 5,
  },
];

async function main() {
  console.log('약관 데이터 시드 시작...');

  for (const consent of consentData) {
    const existing = await prisma.consent.findUnique({
      where: {
        code_version: {
          code: consent.code,
          version: consent.version,
        },
      },
    });

    if (existing) {
      // 기존 데이터 업데이트
      await prisma.consent.update({
        where: { id: existing.id },
        data: {
          title: consent.title,
          content: consent.content,
          isRequired: consent.isRequired,
          isActive: consent.isActive,
          displayOrder: consent.displayOrder,
        },
      });
      console.log(`✅ 업데이트: ${consent.code} v${consent.version}`);
    } else {
      // 신규 생성
      await prisma.consent.create({
        data: consent,
      });
      console.log(`✅ 생성: ${consent.code} v${consent.version}`);
    }
  }

  console.log('약관 데이터 시드 완료!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
