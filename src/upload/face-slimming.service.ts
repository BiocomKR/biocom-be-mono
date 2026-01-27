import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FaceSlimmingResponseDto } from './dto/face-slimming-response.dto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleStorageService } from '../common/services/google-storage.service';
import * as sharp from 'sharp';

/**
 * Google Gemini AI를 활용한 얼굴 슬리밍 서비스
 * FastAPI 포팅 버전 - 재시도 로직 및 구글 스토리지 업로드 포함
 */
@Injectable()
export class FaceSlimmingService {
  private readonly logger = new Logger(FaceSlimmingService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string;
  private readonly timeout: number;
  private readonly maxRetries = 2; // 최대 재시도 횟수

  constructor(
    private readonly configService: ConfigService,
    private readonly googleStorageService: GoogleStorageService
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    this.model = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash-image';
    this.timeout = this.configService.get<number>('FACE_SLIMMING_TIMEOUT') || 60000;

    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY가 설정되지 않았습니다.');
    }

    // Google Gemini AI 초기화
    this.genAI = new GoogleGenerativeAI(apiKey);

    this.logger.log(`얼굴 슬리밍 서비스 초기화 완료! 모델: ${this.model} 🎨`);
  }

  /**
   * 얼굴 슬리밍 처리 메인 함수
   * @param imageBuffer 입력 이미지 버퍼
   * @param weightLoss 체중 감량 효과 (kg)
   * @param originalFileName 원본 파일명
   * @returns 처리 결과
   */
  async processImageSlimming(
    imageBuffer: Buffer,
    weightLoss: number = 5,
    originalFileName: string
  ): Promise<FaceSlimmingResponseDto> {
    const startTime = Date.now();
    let retryCount = 0;

    try {
      // 이미지 버퍼 유효성 검사
      if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
        return this.createErrorResponse('유효하지 않은 이미지 파일입니다.', originalFileName, startTime, retryCount);
      }

      // 이미지 크기 제한 확인 및 리사이징 (800x800 초과시)
      const processedImageBuffer = await this.resizeImageIfNeeded(imageBuffer);

      // 🎯 사람 얼굴 감지 및 검증 (Gemini AI 활용)
      this.logger.log(`사람 얼굴 감지 시작 - 파일: ${originalFileName}`);
      const faceDetectionResult = await this.detectRealHumanFace(processedImageBuffer);
      
      if (!faceDetectionResult.isRealHuman) {
        this.logger.warn(`사람 얼굴이 아님 감지 - 타입: ${faceDetectionResult.detectedType}, 파일: ${originalFileName}`);
        return this.createErrorResponse(
          `챌린지 동기부여를 위해 실제 사람의 얼굴 사진만 업로드해주세요. 감지된 타입: ${faceDetectionResult.description}`,
          originalFileName,
          startTime,
          retryCount
        );
      }

      this.logger.log(`사람 얼굴 감지 성공 - 파일: ${originalFileName}`);

      // 재시도 로직이 포함된 이미지 생성
      const generatedImageBuffer = await this.generateSlimmedImageWithRetry(
        processedImageBuffer, 
        weightLoss
      );

      if (!generatedImageBuffer) {
        return this.createErrorResponse(
          `${this.maxRetries}회 시도 후에도 이미지 생성에 실패했습니다.`, 
          originalFileName, 
          startTime, 
          this.maxRetries
        );
      }

      this.logger.log(`🎨 이미지 생성 완료! 버퍼 크기: ${generatedImageBuffer.length}bytes`);
      
      // 원본 이미지 Google Cloud Storage에 업로드
      this.logger.log(`📤 원본 이미지 Google Storage 업로드 시작 - 파일: ${originalFileName}`);
      const originalUploadResult = await this.googleStorageService.uploadWithFallback(
        processedImageBuffer, // 👈 이미 리사이징된 원본 이미지 (Gemini에 전송했던 것)
        originalFileName,
        'originals',
        this.maxRetries
      );
      const beforeImageUrl = originalUploadResult.url;
      this.logger.log(`📤 원본 이미지 Google Storage 업로드 완료 - URL: ${beforeImageUrl}`);

      // 처리된 이미지 Google Cloud Storage에 업로드 (실패시 로컬 fallback)
      this.logger.log(`📤 처리된 이미지 Google Storage 업로드 시작 - 파일: ${originalFileName}`);
      const uploadResult = await this.googleStorageService.uploadWithFallback(
        generatedImageBuffer, 
        originalFileName, 
        'face-slimming',
        this.maxRetries
      );
      const afterImageUrl = uploadResult.url;
      this.logger.log(`📤 처리된 이미지 Google Storage 업로드 완료 - 위치: ${uploadResult.location}, URL: ${afterImageUrl}`);

      const processingTime = (Date.now() - startTime) / 1000;

      this.logger.log(`얼굴 슬리밍 처리 완료: ${processingTime}초, 체중감량: ${weightLoss}kg, 저장위치: ${uploadResult.location}`);

      return {
        beforeImageUrl,
        afterImageUrl,
        weightLoss,
        processingTime,
        originalFileName,
        success: true,
        retryCount,
        storageLocation: uploadResult.location
      };

    } catch (error) {
      this.logger.error('얼굴 슬리밍 처리 실패:', error.message);
      return this.createErrorResponse(
        `처리 중 오류가 발생했습니다: ${error.message}`,
        originalFileName,
        startTime,
        retryCount
      );
    }
  }

  /**
   * 🎯 사람 얼굴 감지 및 검증 (Gemini AI 활용)
   * 장난감, 인형, 동물, 만화 등을 필터링하여 실제 사람 얼굴만 허용
   */
  private async detectRealHumanFace(imageBuffer: Buffer): Promise<{
    isRealHuman: boolean;
    detectedType: string;
    description: string;
    confidence: string;
  }> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });

      // 🎯 사람 얼굴 감지 프롬프트 (균형잡힌 버전)
      const faceDetectionPrompt = `
이 이미지를 분석해서 다음 중 하나로 응답해주세요:

1. REAL_HUMAN_FACE: 실제 사람의 얼굴 (셀카, 증명사진, 인물사진 포함)
2. TOY_DOLL: 명백한 장난감, 인형, 피규어, 마네킹
3. ANIMAL: 동물 얼굴 (강아지, 고양이 등)
4. CARTOON: 만화, 애니메이션, 그림 캐릭터
5. NO_FACE: 얼굴이 없거나 불분명함

형식:
타입: [위 5개 중 하나]
설명: [한줄 설명]

참고: 일반적인 사람 사진이면 REAL_HUMAN_FACE, 명백히 가짜인 것만 차단하세요.
      `.trim();

      // 이미지를 base64로 변환
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.detectMimeType(imageBuffer);

      this.logger.log('Gemini AI 얼굴 감지 시작');

      // Gemini AI API 호출
      const result = await model.generateContent([
        faceDetectionPrompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        }
      ]);

      const response = await result.response;
      const analysisText = response.text();

      this.logger.log(`Gemini AI 얼굴 감지 응답: ${analysisText}`);

      // 응답 파싱 (관대하게)
      const typeMatch = analysisText.match(/타입:\s*([A-Z_]+)/);
      const descMatch = analysisText.match(/설명:\s*(.+)/);

      const detectedType = typeMatch ? typeMatch[1].trim() : 'UNKNOWN';
      const description = descMatch ? descMatch[1].trim() : '분석 실패';
      const confidence = '자동감지';

      // 실제 사람 얼굴인지 판단 (균형잡힌 방식)
      const isRealHuman = detectedType === 'REAL_HUMAN_FACE';

      this.logger.log(`얼굴 감지 결과 - 타입: ${detectedType}, 사람 여부: ${isRealHuman}, 확신도: ${confidence}`);

      return {
        isRealHuman,
        detectedType,
        description,
        confidence
      };

    } catch (error) {
      this.logger.error('얼굴 감지 실패:', error.message);
      
      // 감지 실패 시 안전하게 차단 (보수적 접근)
      return {
        isRealHuman: false,
        detectedType: 'DETECTION_ERROR',
        description: '얼굴 감지 중 오류가 발생했습니다. 다시 시도해주세요.',
        confidence: '오류'
      };
    }
  }

  /**
   * 재시도 로직이 포함된 이미지 생성 함수
   * FastAPI 코드의 재시도 로직 구현
   */
  private async generateSlimmedImageWithRetry(
    imageBuffer: Buffer, 
    weightLoss: number
  ): Promise<Buffer | null> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.log(`이미지 생성 시도 ${attempt + 1}/${this.maxRetries + 1}`);

        const result = await this.generateSlimmedImage(imageBuffer, weightLoss);
        
        if (result) {
          this.logger.log(`${attempt + 1}번째 시도에서 성공!`);
          return result;
        }

      } catch (error) {
        this.logger.warn(`${attempt + 1}번째 시도 실패: ${error.message}`);
        
        if (attempt === this.maxRetries) {
          this.logger.error(`모든 시도 실패. 최종 에러: ${error.message}`);
          return null;
        }

        // 재시도 전 잠시 대기 (1초)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return null;
  }

  /**
   * Google Gemini AI를 사용한 얼굴 슬리밍 이미지 생성
   * FastAPI의 핵심 로직 포팅
   */
  private async generateSlimmedImage(imageBuffer: Buffer, weightLoss: number): Promise<Buffer | null> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });

      // 3주 건강 챌린지 완주 후 모습 시뮬레이션 프롬프트
      const prompt = `
Improve this person's appearance after ${weightLoss}kg weight loss from a 3-week wellness challenge. Make MINIMAL but effective changes:

🔥 CRITICAL RULES - DO NOT CHANGE:
- Keep the EXACT same facial expression, smile, and mouth position
- Keep ALL moles, freckles, wrinkles, and facial marks exactly as they are
- Keep the same eye expression, eyebrow position, and overall face shape
- Keep the same hair, clothing, and background completely unchanged
- This must look like the SAME PERSON in the SAME MOMENT, just healthier

✨ ONLY MAKE THESE SUBTLE IMPROVEMENTS:
- Slightly cleaner, more radiant skin tone (healthier glow from good nutrition)
- Marginally slimmer jawline and reduced facial puffiness (from weight loss)
- Slightly more defined cheekbones (from reduced facial fat)
- Better skin texture and hydration appearance
- More vibrant, healthy complexion

🎯 THE GOAL: 
Make viewers think "Wow, I want to try this 3-week challenge!" 
The changes should be noticeable enough to be motivating, but subtle enough to look completely natural and achievable.

IMPORTANT: This person should look like themselves having a really good day after getting healthier - NOT like a different person or heavily edited photo.
      `.trim();

      // 이미지를 base64로 변환 (Gemini AI 요구사항)
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.detectMimeType(imageBuffer);

      this.logger.log(`Gemini AI 호출 시작 - 모델: ${this.model}, 체중감량: ${weightLoss}kg`);

      // Gemini AI API 호출
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        }
      ]);

      const response = await result.response;

      // 응답에서 생성된 이미지 추출 (FastAPI 로직 포팅)
      for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData) {
            // base64 데이터를 Buffer로 변환
            const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
            this.logger.log(`이미지 생성 성공! 크기: ${imageBuffer.length} bytes`);
            return imageBuffer;
          }
        }
      }

      // 텍스트 응답만 있는 경우 (이미지 생성 실패)
      this.logger.warn('Gemini AI가 이미지 대신 텍스트 응답을 반환했습니다.');
      return null;

    } catch (error) {
      this.logger.error('Gemini AI 호출 실패:', error.message);
      throw error;
    }
  }

  /**
   * 이미지 크기 확인 및 리사이징 (원본 비율 유지)
   * 형님의 요구사항 구현 - EXIF 회전 정보 자동 적용 + 원본 비율 유지
   */
  private async resizeImageIfNeeded(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // EXIF 회전 정보 먼저 적용
      const rotatedBuffer = await sharp(imageBuffer).rotate().toBuffer();
      const metadata = await sharp(rotatedBuffer).metadata();
      
      this.logger.log(`EXIF 회전 적용 후 이미지 정보: ${metadata.width}x${metadata.height}`);
      
      // 긴 쪽이 800px를 넘으면 비율 유지하면서 리사이징
      const maxDimension = Math.max(metadata.width, metadata.height);
      
      if (maxDimension > 800) {
        const scaleFactor = 800 / maxDimension;
        const newWidth = Math.round(metadata.width * scaleFactor);
        const newHeight = Math.round(metadata.height * scaleFactor);
        
        this.logger.log(`이미지 리사이징: ${metadata.width}x${metadata.height} → ${newWidth}x${newHeight} (비율 유지)`);
        
        return await sharp(rotatedBuffer)
          .resize(newWidth, newHeight, { 
            fit: 'inside', // 비율 유지하면서 리사이징 🎯
            withoutEnlargement: false
          })
          .jpeg({ 
            quality: 85,
            mozjpeg: true
          })
          .toBuffer();
      }

      // 800px 이하면 원본 크기 그대로 유지 (EXIF 회전만 적용)
      this.logger.log(`이미지 크기 적절함: ${metadata.width}x${metadata.height} (EXIF 회전만 적용)`);
      return await sharp(rotatedBuffer)
        .jpeg({ 
          quality: 85,
          mozjpeg: true
        })
        .toBuffer();

    } catch (error) {
      this.logger.warn('이미지 리사이징 실패, 원본 사용:', error.message);
      return imageBuffer;
    }
  }


  /**
   * 이미지 버퍼에서 MIME 타입 감지
   */
  private detectMimeType(buffer: Buffer): string {
    const header = buffer.subarray(0, 4).toString('hex');
    
    if (header.startsWith('89504e47')) return 'image/png';
    if (header.startsWith('ffd8ff')) return 'image/jpeg';
    if (header.startsWith('47494638')) return 'image/gif';
    if (header.startsWith('52494646')) return 'image/webp';
    
    return 'image/jpeg'; // 기본값
  }

  /**
   * 에러 응답 생성 헬퍼 함수
   */
  private createErrorResponse(
    errorMessage: string,
    originalFileName: string,
    startTime: number,
    retryCount: number
  ): FaceSlimmingResponseDto {
    const processingTime = (Date.now() - startTime) / 1000;

    return {
      beforeImageUrl: '',
      afterImageUrl: '',
      weightLoss: 0,
      processingTime,
      originalFileName,
      success: false,
      errorMessage,
      retryCount
    };
  }

  /**
   * 서비스 상태 확인
   */
  isReady(): boolean {
    return !!this.genAI;
  }

  /**
   * 모델 정보 조회
   */
  getModelInfo(): { ready: boolean; model: string; provider: string; maxRetries: number } {
    return {
      ready: this.isReady(),
      model: this.model,
      provider: 'Google Gemini AI',
      maxRetries: this.maxRetries
    };
  }
}