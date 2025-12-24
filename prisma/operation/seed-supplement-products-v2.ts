import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import * as https from 'https';
import * as http from 'http';

const prisma = new PrismaClient();

/**
 * 바이오컴 영양제 상품 시드 데이터
 * 쇼핑몰에서 판매하는 단품 영양제
 *
 * 실행 방법:
 * # 개발 환경 (기본값)
 * npx ts-node prisma/operation/seed-supplement-products-v2.ts
 *
 * # 운영 환경
 * GCS_BUCKET=api-prod-biocom-uploads npx ts-node prisma/operation/seed-supplement-products-v2.ts
 */

// GCS 설정 (환경변수로 개발/운영 분리)
const BUCKET_NAME = process.env.GCS_BUCKET || 'api-dev-biocom-uploads';
const GCS_FOLDER = 'supplement'; // supplement 폴더에 업로드

/**
 * 원격 URL에서 이미지를 다운로드
 */
async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    protocol.get(url, (response: http.IncomingMessage) => {
      // 리다이렉트 처리
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadImage(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`이미지 다운로드 실패: ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * 이미지를 GCS에 업로드하고 URL 반환
 */
async function uploadImageToGCS(storage: Storage, sku: string, imageUrl: string): Promise<string | null> {
  try {
    // 이미지 다운로드
    console.log(`      ⬇️  다운로드: ${imageUrl.substring(0, 60)}...`);
    const imageBuffer = await downloadImage(imageUrl);
    console.log(`      📦 다운로드 완료: ${(imageBuffer.length / 1024).toFixed(1)}KB`);

    // 확장자 추출
    const urlPath = new URL(imageUrl).pathname;
    const ext = urlPath.substring(urlPath.lastIndexOf('.')) || '.png';

    const bucket = storage.bucket(BUCKET_NAME);
    const destination = `${GCS_FOLDER}/${sku}${ext}`;
    const file = bucket.file(destination);

    // 이미 존재하는지 확인
    const [exists] = await file.exists();
    if (exists) {
      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
      console.log(`      ⏩ 이미 업로드됨: ${sku}${ext}`);
      return publicUrl;
    }

    // 업로드
    await file.save(imageBuffer, {
      metadata: {
        contentType: `image/${ext.replace('.', '') === 'jpg' ? 'jpeg' : ext.replace('.', '')}`,
      },
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
    console.log(`      ✅ 업로드 완료: ${sku}${ext}`);
    return publicUrl;
  } catch (error) {
    console.error(`      ❌ 업로드 실패: ${sku}`, error.message);
    return null;
  }
}

interface SupplementProduct {
  sku: string;
  name: string;
  description: string;
  price: number; // 할인가
  originalPrice: number; // 정가
  imageUrl: string;
  manufacturer: string; // 제조사
  brand: string; // 브랜드
  isOverseas?: boolean; // 해외직구 여부
}

const supplementProducts: SupplementProduct[] = [
  // 단품 영양제
  {
    sku: 'SUPP_RESET_DAY',
    name: '리셋데이 글루텐분해효소 알파CD 차전자피 K-낙산균',
    description: '글루텐분해효소, 차전자피, K-낙산균이 함유된 장 건강 영양제',
    price: 24900,
    originalPrice: 36000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251215/f970b6d8ea55a.png',
    manufacturer: '엔피케이(주)',
    brand: '바이오컴',
  },
  {
    sku: 'SUPP_METADREAM',
    name: '메타드림 식물성 멜라토닌 함유',
    description: '식물성 멜라토닌 3mg, 테아닌, 마그네슘, 트립토판 함유 수면 영양제',
    price: 36900,
    originalPrice: 46000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/45de9ba884bb6.jpg',
    manufacturer: '콜마비앤에이치(주)',
    brand: '바이오컴',
  },
  {
    sku: 'SUPP_DANGDANG',
    name: '혈당관리엔 당당케어 (120정)',
    description: '바나바잎 추출물, 가르시니아, 비타민B 함유 혈당관리 영양제',
    price: 59800,
    originalPrice: 100000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/b256d7483c699.png',
    manufacturer: '엔피케이',
    brand: '바이오컴',
  },
  {
    sku: 'SUPP_BIO_BALANCE',
    name: '바이오밸런스 90정 (1개월분)',
    description: '마그네슘, 아연, 셀레늄, 망간 함유 피로회복 미네랄 영양제',
    price: 39000,
    originalPrice: 60000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/ded5eb6d3f7b7.jpg',
    manufacturer: '네이처퓨어',
    brand: '바이오컴',
  },
  {
    sku: 'SUPP_CLEAN_BALANCE',
    name: '클린밸런스 120정 (1개월분)',
    description: '클로렐라, 활성엽산 함유 이너뷰티 피부 영양제 (식약처 피부기능성 인정)',
    price: 49000,
    originalPrice: 75000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/9afbfce20eec4.png',
    manufacturer: '네이처퓨어',
    brand: '바이오컴',
  },
  {
    sku: 'SUPP_NEURO_MASTER',
    name: '뉴로마스터 60정 (1개월분)',
    description: '은행잎추출물, 요오드 함유 혈행/기억력/건망증 개선 영양제',
    price: 35000,
    originalPrice: 60000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/d2775c537a432.jpg',
    manufacturer: '네이처퓨어',
    brand: '바이오컴',
  },
  {
    sku: 'SUPP_YOUNG_DAYS',
    name: '영데이즈 저속노화 SOD 효소 (15포)',
    description: 'SOD 효소, 리포좀 글루타치온 함유 저속노화 영양제',
    price: 36000,
    originalPrice: 45000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/4937b7fd04ec2.png',
    manufacturer: '엔피케이',
    brand: '바이오컴',
  },
  {
    sku: 'SUPP_PUNGSUNG',
    name: '풍성밸런스 90정 (1개월분)',
    description: '비오틴, 맥주효모, 엘시스테인 함유 모발 영양제',
    price: 35000,
    originalPrice: 65000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/020f9605eda21.png',
    manufacturer: '네이처퓨어',
    brand: '바이오컴',
  },
  {
    sku: 'SUPP_DARAE_CARE',
    name: '다래케어 180정 (1개월분)',
    description: '다래추출물 함유 면역력/과민반응 영양제 (무부형제)',
    price: 68400,
    originalPrice: 120000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/27b5849bec8fb.png',
    manufacturer: '엔피케이',
    brand: '바이오컴',
  },
  {
    sku: 'SUPP_SUNFIBER',
    name: '썬화이버 프리바이오틱스 식이섬유 210g',
    description: '구아검가수분해물 저포드맵 프리바이오틱스',
    price: 36000,
    originalPrice: 57000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251218/ab99a04e1c54b.jpg',
    manufacturer: '투모로우뉴트리션',
    brand: 'Sunfiber',
  },
  {
    sku: 'SUPP_BANGTAN_JELLY',
    name: '팀키토 방탄젤리 청포도맛 30g 15포',
    description: '식이섬유 함유 무설탕 젤리',
    price: 22900,
    originalPrice: 30000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250221/f49026d409e21.jpeg',
    manufacturer: '',
    brand: '팀키토',
  },
  // SET 상품
  {
    sku: 'SUPP_CLEAN_INNER_SET',
    name: '클린 이너뷰티 SET',
    description: '클린밸런스 1개 + 영데이즈 2개 세트',
    price: 99900,
    originalPrice: 165000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251208/da71fdb22b5c8.jpg',
    manufacturer: '엔피케이',
    brand: '바이오컴',
  },
  {
    sku: 'SUPP_SCALP_WINTER_SET',
    name: '두피 월동 준비 SET',
    description: '바이오밸런스 1개 + 풍성밸런스 1개 세트',
    price: 59900,
    originalPrice: 125000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251128/2841cea4c4889.jpg',
    manufacturer: '네이처퓨어',
    brand: '바이오컴',
  },
  // ===== 해외직구 영양제 (다빈치랩) =====
  {
    sku: 'SUPP_DV_GLUTATHIONE',
    name: '다빈치랩 글루타치온 (Glutathione) 30일분',
    description: '리포좀 글루타치온 영양제',
    price: 49000,
    originalPrice: 99000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/02e98f6a8d00d.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_MITO_FUEL',
    name: '다빈치랩 미토 퓨얼 (Mito-Fuel) 30일분',
    description: '미토콘드리아 에너지 대사 영양제',
    price: 99000,
    originalPrice: 150000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20241120/097b566d18f90.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_MAXI_HGH',
    name: '다빈치랩 맥시-HGH (Maxi-HGH) 30일분',
    description: '성장호르몬 지원 영양제',
    price: 102000,
    originalPrice: 150000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20241120/e5d5b382f563e.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_ADRENALYZE',
    name: '다빈치랩 아드레날라이즈 (AdrenaLyze) 30일분',
    description: '부신 건강 지원 영양제',
    price: 53000,
    originalPrice: 67000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20240627/7fe1baaa1ea53.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_INOSITOL_VITEX',
    name: '다빈치랩 이노시톨 바이텍스 플러스 (Inositol + Vitex Plus) 30일분',
    description: '여성 호르몬 밸런스 영양제',
    price: 60000,
    originalPrice: 71000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20240627/1a8f377df7ab9.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_CURCUMIN_C3',
    name: '다빈치랩 커큐민 C3 복합체 (Curcumin C3 Complex) 30일분',
    description: '강황 커큐민 항염 영양제',
    price: 54000,
    originalPrice: 64000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20240627/6a858b17595c6.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_MEGA_PROBIOTIC',
    name: '다빈치랩 메가프로바이오틱 ND120 (MEGA PROBIOTIC ND120) 40일분',
    description: '고함량 프로바이오틱스 유산균 (유당없는 유산균)',
    price: 61000,
    originalPrice: 78000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/2568060b49060.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_ENZYME_BENEFITS',
    name: '다빈치랩 엔자임 베네핏 (ENZYME BENEFITS) 30일분',
    description: '소화효소 영양제',
    price: 46000,
    originalPrice: 66000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/ab4e57f4d1b32.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_LIPOSOMAL_C',
    name: '다빈치랩 리포조말 비타민C (LIPOSOMAL C) 60일분',
    description: '리포솜 비타민C 1250mg',
    price: 45900,
    originalPrice: 65000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/fdcbe9ab6f69f.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_NATURE_COLLAGEN',
    name: '다빈치랩 네이처 콜라겐 (NATURE\'S COLLAGEN) 45일분',
    description: '관절/연골 건강 콜라겐 영양제',
    price: 63000,
    originalPrice: 76000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/f884a0826ea15.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_IMMUNO_BENEFITS',
    name: '다빈치랩 이뮤노 베네핏 (IMMUNO BENEFITS) 30일분',
    description: '면역글로불린G, 모노라우린 함유 면역 영양제',
    price: 58000,
    originalPrice: 69000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/c8f7183e8a46d.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_LEPTIN_BENEFITS',
    name: '다빈치랩 렙틴 베네핏 (ADIPO-LEPTIN BENEFITS) 30일분',
    description: '아디포넥틴, 렙틴 - 식욕조절/인슐린저항성 영양제',
    price: 51000,
    originalPrice: 67000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/e2f4b468db045.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_BRAIN_BENEFITS',
    name: '다빈치랩 브레인 베네핏 (BRAIN BENEFITS) 40일분',
    description: '고함량 EPA DHA 액상 오메가3 (뇌 건강)',
    price: 52000,
    originalPrice: 62000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/07fb8da99fe2e.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_LIPOSOMAL_THEANINE',
    name: '다빈치랩 리포조말 엘테아닌 (LIPOSOMAL L-THEANINE) 50일분',
    description: '리포좀 L-테아닌 긴장완화/스트레스 완화 영양제',
    price: 49000,
    originalPrice: 60000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/58c9fb8408445.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_COQ10_DMG',
    name: '다빈치랩 고용량 코큐텐 DMG (COQ10 DMG 300/300mg) 60일분',
    description: '고용량 코엔자임Q10 300mg 혈액순환 영양제',
    price: 98000,
    originalPrice: 135000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/f1483fa52a6f1.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_VITAMIN_E',
    name: '다빈치랩 네츄럴 비타민E 플러스 (NATURAL MIXED TOCOPHEROL E-400) 60일분',
    description: '천연 혼합 토코페롤 비타민E 항산화 영양제',
    price: 43000,
    originalPrice: 49000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/21f508cd0a2a6.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
  {
    sku: 'SUPP_DV_MAITAKE_DMG',
    name: '다빈치랩 어큐트 마이타케 DMG 리퀴드 (Maitake-DMG Liquid) 30일분',
    description: '잎새버섯 마이타케 D프랙션 베타글루칸 면역 영양제',
    price: 89000,
    originalPrice: 104000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/54bd237c50f07.png',
    manufacturer: '다빈치랩',
    brand: 'Davinci Lab',
    isOverseas: true,
  },
];

async function main() {
  console.log('💊 바이오컴 영양제 상품 시드 시작...\n');
  console.log(`☁️  GCS 버킷: ${BUCKET_NAME}/${GCS_FOLDER}\n`);

  // GCS 초기화
  const storage = new Storage();

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalImagesUploaded = 0;
  let domesticCount = 0;
  let overseasCount = 0;

  for (const product of supplementProducts) {
    // 해외직구 여부 카운트
    if (product.isOverseas) {
      overseasCount++;
    } else {
      domesticCount++;
    }

    // 이미지를 GCS에 업로드
    const uploadedImageUrl = await uploadImageToGCS(storage, product.sku, product.imageUrl);
    const finalImageUrl = uploadedImageUrl || product.imageUrl; // 업로드 실패 시 원본 URL 사용
    if (uploadedImageUrl) {
      totalImagesUploaded++;
    }
    // 기존 상품 조회 (SKU로)
    const existing = await prisma.product.findFirst({
      where: { sku: product.sku },
    });

    const now = new Date();

    // 상품 productInfo JSON
    const productInfo = {
      manufacturer: product.manufacturer,
      brand: product.brand,
      isOverseas: product.isOverseas || false,
    };

    // 해외직구 여부에 따른 카테고리 및 배송 정책
    const categoryCode = product.isOverseas ? 'OVERSEAS_SUPPLEMENT' : 'SUPPLEMENT';
    const categoryName = product.isOverseas ? '해외직구 영양제' : '영양제';
    const shippingPolicy = product.isOverseas ? 'PAID' : 'FREE';
    const shippingFee = product.isOverseas ? 5000 : 0; // 해외직구는 배송비 5000원

    // 파일 확장자 추출
    const urlPath = new URL(product.imageUrl).pathname;
    const ext = urlPath.substring(urlPath.lastIndexOf('.')) || '.png';
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.replace('.', '')}`;

    if (existing) {
      // 기존 데이터 업데이트
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: product.name,
          description: product.description,
          categoryCode,
          categoryName,
          price: product.price,
          originalPrice: product.originalPrice,
          productInfo,
          shippingPolicy,
          shippingFee,
          status: 'ACTIVE',
          updatedAt: now,
        },
      });
      const overseasTag = product.isOverseas ? ' [해외]' : '';
      console.log(`✅ 업데이트: ${product.name}${overseasTag} (ID: ${existing.id}, ₩${product.price.toLocaleString()})`);
      totalUpdated++;

      // 이미지 업데이트
      const existingFile = await prisma.productFile.findFirst({
        where: { productId: existing.id, imageType: 'MAIN' },
      });

      if (existingFile) {
        await prisma.file.update({
          where: { id: existingFile.fileId },
          data: { filePath: finalImageUrl },
        });
      } else {
        // File + ProductFile 생성
        const file = await prisma.file.create({
          data: {
            storedName: `${product.sku}-main${ext}`,
            originalName: `${product.name} 메인 이미지`,
            mimeType,
            fileSize: 0,
            filePath: finalImageUrl,
            storageType: 'GCS',
          },
        });
        await prisma.productFile.create({
          data: {
            productId: existing.id,
            fileId: file.id,
            imageType: 'MAIN',
            sortOrder: 0,
            createdAt: now,
            altText: product.name,
          },
        });
        console.log(`   📷 이미지 등록 완료`);
      }
    } else {
      // 신규 생성
      const createdProduct = await prisma.product.create({
        data: {
          sku: product.sku,
          name: product.name,
          description: product.description,
          categoryCode,
          categoryName,
          productType: product.sku.includes('SET') ? 'SET' : 'SINGLE',
          price: product.price,
          originalPrice: product.originalPrice,
          productInfo,
          status: 'ACTIVE',
          shippingPolicy,
          shippingFee,
          createdAt: now,
        },
      });
      const overseasTag = product.isOverseas ? ' [해외]' : '';
      console.log(`✅ 생성: ${product.name}${overseasTag} (ID: ${createdProduct.id}, SKU: ${product.sku}, ₩${product.price.toLocaleString()})`);
      totalCreated++;

      // 이미지 등록
      const file = await prisma.file.create({
        data: {
          storedName: `${product.sku}-main${ext}`,
          originalName: `${product.name} 메인 이미지`,
          mimeType,
          fileSize: 0,
          filePath: finalImageUrl,
          storageType: 'GCS',
        },
      });
      await prisma.productFile.create({
        data: {
          productId: createdProduct.id,
          fileId: file.id,
          imageType: 'MAIN',
          sortOrder: 0,
          createdAt: now,
          altText: product.name,
        },
      });
      console.log(`   📷 이미지 등록 완료`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 바이오컴 영양제 상품 시드 완료!');
  console.log(`📊 총 결과: 생성 ${totalCreated}개, 업데이트 ${totalUpdated}개`);
  console.log(`🖼️  이미지 GCS 업로드: ${totalImagesUploaded}개`);
  console.log(`📦 국내 영양제: ${domesticCount}개, 해외직구: ${overseasCount}개`);
  console.log('='.repeat(60));

  // 결과 요약
  const domesticTotal = await prisma.product.count({
    where: { categoryCode: 'SUPPLEMENT' },
  });
  const domesticActive = await prisma.product.count({
    where: { categoryCode: 'SUPPLEMENT', status: 'ACTIVE' },
  });
  const overseasTotal = await prisma.product.count({
    where: { categoryCode: 'OVERSEAS_SUPPLEMENT' },
  });
  const overseasActive = await prisma.product.count({
    where: { categoryCode: 'OVERSEAS_SUPPLEMENT', status: 'ACTIVE' },
  });
  console.log(`\n📋 영양제 상품 현황:`);
  console.log(`   국내 영양제: 총 ${domesticTotal}개 (활성: ${domesticActive}개)`);
  console.log(`   해외직구 영양제: 총 ${overseasTotal}개 (활성: ${overseasActive}개)`);
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
