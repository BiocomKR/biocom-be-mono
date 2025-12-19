/**
 * 페르소나 영상 파일을 Google Cloud Storage에 업로드
 */

import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET_NAME = 'api-dev-biocom-uploads';
const PROJECT_ID = 'api-dev-biocom';
const VIDEO_DIR = path.resolve(__dirname, '../../assets/persona_videos');

async function main() {
  // Service Account Key 경로 (로컬 개발용)
  const keyFilePath = path.resolve(__dirname, '../google-service-account-key.json');

  let storage: Storage;

  if (fs.existsSync(keyFilePath)) {
    storage = new Storage({
      projectId: PROJECT_ID,
      keyFilename: keyFilePath,
    });
    console.log('✅ Service Account Key 방식으로 인증');
  } else {
    storage = new Storage({
      projectId: PROJECT_ID,
    });
    console.log('⚠️ Application Default Credentials 방식으로 인증');
  }

  // 영상 파일 목록 조회
  const files = fs.readdirSync(VIDEO_DIR).filter(f => f.endsWith('.mp4'));

  console.log(`\n📂 업로드할 영상 파일: ${files.length}개`);
  console.log(files.map(f => `  - ${f}`).join('\n'));
  console.log('');

  const results: { fileName: string; englishName: string; url: string }[] = [];

  for (const fileName of files) {
    const filePath = path.join(VIDEO_DIR, fileName);

    // 한글 파일명을 영문으로 변환
    const nameMap: Record<string, string> = {
      '메이브_압축.mp4': 'maeve.mp4',
      '스텔라_압축.mp4': 'stella.mp4',
      '이안_압축.mp4': 'ian.mp4',
      '테오_압축.mp4': 'theo.mp4',
      '헤이즐_압축.mp4': 'hazel.mp4',
      '헨리_압축.mp4': 'henry.mp4',
    };
    const englishName = nameMap[fileName] || fileName;
    const destFileName = `persona_videos/${englishName}`;

    console.log(`📤 업로드 중: ${fileName}...`);

    try {
      await storage.bucket(BUCKET_NAME).upload(filePath, {
        destination: destFileName,
        metadata: {
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000', // 1년 캐시
        },
      });

      const url = `https://storage.googleapis.com/${BUCKET_NAME}/${destFileName}`;
      results.push({ fileName, englishName, url });
      console.log(`   ✅ 완료: ${url}`);
    } catch (error: any) {
      console.error(`   ❌ 실패: ${error.message}`);
    }
  }

  console.log('\n=== 업로드 결과 ===\n');

  // 표 형식으로 출력
  console.log('| 원본파일명 | 영문파일명 | URL |');
  console.log('|------------|------------|-----|');
  for (const r of results) {
    console.log(`| ${r.fileName} | ${r.englishName} | ${r.url} |`);
  }

  console.log('\n=== JSON 형식 ===\n');
  console.log(JSON.stringify(results, null, 2));

  console.log(`\n총 ${results.length}/${files.length}개 업로드 완료`);
}

main().catch(console.error);
