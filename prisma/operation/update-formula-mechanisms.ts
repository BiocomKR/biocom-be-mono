import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 각 동물별 FORMULA mechanisms 데이터
const formulaMechanismsData = [
  {
    // 화끈한 불여우 (SKIN_HEALTH) - ID:1, productId:48
    healthTypeAnimalId: 1,
    productId: 48,
    mechanisms: {
      formulaName: '바이오 밸런스 + 클린 밸런스 + 영데이즈',
      formulaDescription:
        '염증을 다각도로 완전 제어합니다. 양방향 염증 제어 → 독소 제거 → 이중 항산화 시스템 구축으로 염증 생성을 원천 봉쇄하고 잔불까지 완전 소화합니다.',
      synergyEffects: [
        {
          title: '염증 해소 시스템 완벽 구축',
          result: '염증을 끄는 시스템 완벽 작동으로 잔불까지 완전 소화',
          items: [
            { product: '바이오 밸런스', effect: '비타민D+마그네슘이 염증 해소 물질(SPMs) 생성 효소 활성화' },
            { product: '클린 밸런스', effect: '비타민E+C가 오메가-3 산화 방지 및 재생 시스템 구축' },
            { product: '영데이즈', effect: '비타민E+C+글루타치온이 항산화 네트워크로 오메가-3 완벽 보호' },
          ],
        },
        {
          title: '이중 항산화 시스템 구축',
          result: '1차+2차 이중 방어로 활성산소 완전 차단하여 세포 완벽 보호',
          items: [
            { product: '영데이즈', effect: 'SOD+카탈레이즈가 활성산소 1차 대량 제거 (효소 방어)' },
            { product: '클린 밸런스', effect: '비타민E+C가 항산화 네트워크 강화로 시너지 효과 극대화' },
            { product: '바이오 밸런스', effect: '셀레늄+망간이 항산화 효소 활성화로 1차 방어 지원' },
          ],
        },
        {
          title: '독소 완전 제거 루트',
          result: '독소 완전 제거로 염증 재발 원천 차단',
          items: [
            { product: '바이오 밸런스', effect: '셀레늄+망간+몰리브덴이 장내 독소 중화' },
            { product: '클린 밸런스', effect: '클로렐라가 염증 유발 내독소(LPS) 흡착하여 체외 배출' },
            { product: '영데이즈', effect: '글루타치온이 독소 결합 및 배출로 염증 환경 정리' },
          ],
        },
        {
          title: '염증 생성 3중 차단 시스템',
          result: '3중 차단으로 염증 생성 원천 봉쇄',
          items: [
            { product: '바이오 밸런스', effect: '셀레늄+망간이 염증성 신호물질 및 활성산소 직접 제거' },
            { product: '클린 밸런스', effect: '비타민E+C가 염증 매개물질 생성 억제 및 염증 신호 차단' },
            { product: '영데이즈', effect: 'SOD+카탈레이즈가 염증 촉발 활성산소 2단계 완전 제거' },
          ],
        },
      ],
    },
  },
  {
    // 동면 중인 북극곰 (METABOLISM) - ID:2, productId:49
    healthTypeAnimalId: 2,
    productId: 49,
    mechanisms: {
      formulaName: '당당케어 + 뉴로마스터 + 바이오 밸런스',
      formulaDescription:
        '대사 개선을 위한 최적의 환경이 조성됩니다. 뉴로마스터가 생성한 갑상선 호르몬 T4는 바이오 밸런스의 셀레늄, 아연, 마그네슘, 비타민D가 활성형 T3로 전환해야 비로소 제대로 작동하며, 당당케어는 인슐린 저항성 개선에 도움을 줍니다.',
      synergyEffects: [
        {
          title: '인슐린 저항성 개선',
          result: '멈춰있던 세포가 다시 당을 받아들이기 시작',
          items: [
            { product: '당당케어', effect: '코로솔산과 크롬이 세포의 포도당 흡수 촉진' },
            { product: '당당케어', effect: 'HCA가 높은 혈당이 체지방으로 저장되는 것을 차단' },
            { product: '당당케어', effect: '비타민B군 8종이 에너지 대사 활성화' },
          ],
        },
        {
          title: '갑상선 호르몬 생성',
          result: '대사 호르몬 T4 생성되지만 활성화 필요',
          items: [
            { product: '뉴로마스터', effect: '요오드가 갑상선 호르몬(T4) 생성' },
            { product: '뉴로마스터', effect: '은행잎추출물이 혈액 순환 개선' },
            { product: '뉴로마스터', effect: '세포 에너지 공급 극대화' },
          ],
        },
        {
          title: '호르몬 활성화 + 염증 제거',
          result: 'T4→T3 전환으로 갑상선 호르몬 완전 활성화',
          items: [
            { product: '바이오 밸런스', effect: '셀레늄, 아연, 마그네슘, 비타민D가 T4를 활성형 T3로 전환 후 작용 증폭' },
            { product: '바이오 밸런스', effect: '셀레늄과 망간이 염증 차단하여 인슐린 저항성 악화 방지' },
          ],
        },
        {
          title: '3단계 시너지 효과',
          result: '대사가 근본적으로 회복되어 피로·쉽게 찌는 체질·피부 노화 개선',
          items: [
            { product: '당당케어', effect: '인슐린 저항성 개선으로 대사 기반 마련' },
            { product: '뉴로마스터 + 바이오 밸런스', effect: 'T4 생성 후 T3로 전환하여 기초 대사량 증가' },
            { product: '바이오 밸런스', effect: '염증 제거로 대사 방해 요인 차단' },
          ],
        },
      ],
    },
  },
  {
    // 배 빵빵 펭귄 (GUT_HEALTH) - ID:3, productId:50
    healthTypeAnimalId: 3,
    productId: 50,
    mechanisms: {
      formulaName: '바이오 밸런스 + 클린 밸런스 + 당당케어',
      formulaDescription:
        '장벽 복구 → 독소 제거 → 유해균 먹이 차단으로 3단계 선순환 시스템이 작동하여 장누수증후군과 SIBO를 근본적으로 해결합니다.',
      synergyEffects: [
        {
          title: '장벽 3중 강화 시스템',
          result: '3단계 방어벽 완성으로 장누수 완화',
          items: [
            { product: '바이오 밸런스', effect: '아연+마그네슘이 밀착연접 단백질 합성' },
            { product: '클린 밸런스', effect: '비타민A가 점액층 두껍게 형성' },
            { product: '당당케어', effect: '비타민B군이 장 세포 재생 에너지 공급' },
          ],
        },
        {
          title: '독소 완전 제거 루트',
          result: '장-피부 축 염증 차단으로 턱 트러블 개선',
          items: [
            { product: '바이오 밸런스', effect: '셀레늄+망간+몰리브덴이 장내 독소 중화' },
            { product: '클린 밸런스', effect: '클로렐라가 독소 흡착하여 체외 배출' },
            { product: null, effect: '비타민C+E가 혈액 속 염증 물질 제거' },
          ],
        },
        {
          title: '장내 유해균 이중 억제',
          result: '복부 팽만과 가스 생성 근본 해결',
          items: [
            { product: '바이오 밸런스', effect: '비타민D가 항균 펩타이드 생성' },
            { product: '클린 밸런스', effect: '아연이 유해균 증식 억제' },
            { product: '당당케어', effect: '크롬+바나바잎이 혈당 조절로 유해균 먹이 차단' },
          ],
        },
        {
          title: '세포 재생 가속화',
          result: '손상된 장 점막 빠른 회복',
          items: [
            { product: '바이오 밸런스', effect: '아연이 DNA 합성 촉진' },
            { product: '클린 밸런스', effect: '비타민A+C가 콜라겐 합성 지원' },
            { product: '당당케어', effect: '비타민B군(B₂,B₃,B₆,B₉)이 세포 분열 에너지 공급' },
          ],
        },
      ],
    },
  },
  {
    // 예민한 고슴도치 (IMMUNE_BALANCE) - ID:4, productId:51
    healthTypeAnimalId: 4,
    productId: 51,
    mechanisms: {
      formulaName: '다래케어 + 바이오 밸런스 + 클린 밸런스',
      formulaDescription:
        '면역계를 다각도로 안정화합니다. 과민 반응 직접 조절 → 장벽 복구 → 독소 제거로 3단계 시너지가 작동하여 사소한 자극에도 반응하던 면역계가 정상화됩니다.',
      synergyEffects: [
        {
          title: '면역 이중 안정화 시스템',
          result: '2단계 면역 조절로 사소한 자극에도 반응하던 면역계 정상화',
          items: [
            { product: '다래케어', effect: '다래추출물이 면역 과민 반응 스위치 직접 OFF' },
            { product: '바이오 밸런스', effect: '비타민D가 면역 균형(Th17/Treg) 조절로 근본 정상화' },
            { product: null, effect: '아연이 장벽 복구로 면역 과민 상태의 출발점 차단' },
          ],
        },
        {
          title: '장벽 3중 복구 시스템',
          result: '장누수 완화로 면역 \'전군 비상 경계령\' 해제',
          items: [
            { product: '다래케어', effect: '아연 8.5mg이 밀착연접 단백질 합성' },
            { product: '바이오 밸런스', effect: '아연 12mg + 마그네슘 315mg이 장벽 세포 간 이음새 촘촘하게 결합' },
            { product: '클린 밸런스', effect: '비타민A가 장 점막 보호층(뮤신) 두껍게 형성' },
          ],
        },
        {
          title: '면역 자극 독소 완전 제거',
          result: '면역계 부담 직접 감소로 과민 반응 완화',
          items: [
            { product: '바이오 밸런스', effect: '셀레늄+망간+몰리브덴이 장내 독소 중화' },
            { product: '클린 밸런스', effect: '클로렐라가 면역 자극 내독소(LPS) 흡착하여 체외 배출' },
            { product: null, effect: '비타민C+E가 항산화로 염증 물질 제거' },
          ],
        },
        {
          title: '피부 장벽 강화로 자극 방어',
          result: '외부 자극에도 쉽게 흔들리지 않는 탄탄한 방어막 형성',
          items: [
            { product: '클린 밸런스', effect: '비타민A가 피부 각질 정상화로 외부 자극 방어력 증가' },
            { product: null, effect: '아연이 피부 재생 촉진으로 자극 내성 증가' },
            { product: '클린 밸런스', effect: '비타민C+E가 피부 세포 보호 및 염증 완화' },
          ],
        },
      ],
    },
  },
];

async function main() {
  console.log('==========================================');
  console.log('FORMULA mechanisms 데이터 업데이트');
  console.log('==========================================\n');

  for (const data of formulaMechanismsData) {
    console.log(`\n--- healthTypeAnimalId: ${data.healthTypeAnimalId}, productId: ${data.productId} ---`);
    console.log(`formulaName: ${data.mechanisms.formulaName}`);

    // 해당 레코드 찾기
    const record = await prisma.healthTypeAnimalProduct.findFirst({
      where: {
        healthTypeAnimalId: data.healthTypeAnimalId,
        productId: data.productId,
        type: 'FORMULA',
      },
    });

    if (!record) {
      console.log(`  ❌ 레코드를 찾을 수 없습니다.`);
      continue;
    }

    // mechanisms 업데이트
    await prisma.healthTypeAnimalProduct.update({
      where: { id: record.id },
      data: { mechanisms: data.mechanisms },
    });

    console.log(`  ✅ ID:${record.id} mechanisms 업데이트 완료`);
  }

  console.log('\n==========================================');
  console.log('완료!');
  console.log('==========================================');
}

main()
  .catch((e) => {
    console.error('에러:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
