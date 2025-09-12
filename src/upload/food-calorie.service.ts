import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoodAnalysisResponseDto } from './dto/food-analysis-response.dto';
import { GoogleStorageService } from '../common/services/google-storage.service';
import OpenAI from 'openai';
import * as sharp from 'sharp';

/**
 * 음식 칼로리 계산 서비스 (GPT-5 모델 활용)
 * 이미지 리사이징 및 최적화 기능 포함
 */
@Injectable()
export class FoodCalorieService {
  private readonly logger = new Logger(FoodCalorieService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly googleStorageService: GoogleStorageService
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o';
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
    }

    const timeout = this.configService.get<number>('AI_ANALYSIS_TIMEOUT') || 30000;
    this.openai = new OpenAI({
      apiKey: apiKey,
      timeout: timeout, // 환경변수에서 가져온 타임아웃 값
    });

    this.logger.log(`음식 칼로리 계산 서비스 초기화 완료! 모델: ${this.model} 🍽️`);
  }

  /**
   * 음식 이미지 분석 (GPT-5 Vision API 사용)
   * 이미지 리사이징 및 최적화 포함, Google Storage 업로드
   * @param imageBuffer 이미지 버퍼
   * @param originalFileName 원본 파일명
   * @returns 음식 분석 결과
   */
  async analyzeFoodImage(imageBuffer: Buffer, originalFileName: string = 'food.jpg'): Promise<FoodAnalysisResponseDto> {
    try {
      // 이미지 버퍼 유효성 검사
      if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
        return {
          food_items: [],
          total: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          errorMessage: '유효하지 않은 이미지 파일입니다.'
        };
      }

      // 이미지 리사이징 및 최적화 (얼굴 슬리밍과 동일한 로직)
      const processedImageBuffer = await this.resizeAndOptimizeImage(imageBuffer);

      // Base64로 이미지 인코딩
      const base64Image = processedImageBuffer.toString('base64');
      const mimeType = this.detectMimeType(imageBuffer);

      // GPT-4 모델 사용 (OpenAI API 활용)
      const koreanPrompt = `이미지의 음식을 분석하여 다음 정보를 JSON 형식으로 제공해주세요:
{
    "food_items": [
        {
            "name": "음식명",
            "portion": "분량", 
            "calories": 칼로리(숫자),
            "protein": 단백질(숫자),
            "carbs": 탄수화물(숫자),
            "fat": 지방(숫자)
        }
    ],
    "total": {
        "calories": 총칼로리(숫자),
        "protein": 총단백질(숫자),
        "carbs": 총탄수화물(숫자),
        "fat": 총지방(숫자)
    }
}
반드시 위 JSON 형식으로만 응답하세요.`;

      this.logger.log(`GPT-5 API 호출 시작 - 모델: ${this.model}`);

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "당신은 음식 이미지를 분석하여 정확한 영양 정보를 제공하는 전문 영양사입니다. JSON 형식으로만 응답하세요."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: koreanPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_completion_tokens: 1000,
        temperature: 0.1
      });

      const analysisResult = response.choices[0]?.message?.content || '';
      this.logger.log(`GPT-5 응답: ${analysisResult.slice(0, 200)}...`);

      // JSON 파싱 시도
      const jsonMatch = analysisResult.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          const parsedResult = JSON.parse(jsonMatch[0]);
          
          // 응답 구조 검증
          if (parsedResult.food_items !== undefined && parsedResult.total) {
            this.logger.log(`음식 분석 성공: ${parsedResult.food_items.length}개 항목 발견`);
            
            // 처리된 이미지를 Google Cloud Storage에 업로드
            let imageUrl: string | null = null;
            let storageLocation: 'google-storage' | 'local-fallback' | null = null;
            
            try {
              const uploadResult = await this.googleStorageService.uploadWithFallback(
                processedImageBuffer,
                originalFileName,
                'food-calorie',
                2 // 최대 재시도 2회
              );
              imageUrl = uploadResult.url;
              storageLocation = uploadResult.location;
              this.logger.log(`음식 이미지 업로드 완료: ${uploadResult.location}`);
            } catch (uploadError) {
              this.logger.warn('음식 이미지 업로드 실패, 분석 결과만 반환:', uploadError.message);
            }
            
            return {
              food_items: parsedResult.food_items || [],
              total: parsedResult.total || { calories: 0, protein: 0, carbs: 0, fat: 0 },
              imageUrl,
              storageLocation
            };
          }

        } catch (parseError) {
          this.logger.error('JSON 파싱 실패:', parseError.message);
        }
      }

      // JSON 파싱 실패 시 기본값 반환
      this.logger.warn('GPT-5 응답 파싱 실패로 기본값 반환');
      return {
        food_items: [],
        total: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        errorMessage: 'AI 응답을 파싱할 수 없습니다.'
      };

    } catch (error) {
      this.logger.error('GPT-5 음식 이미지 분석 실패:', error.message);
      
      return {
        food_items: [],
        total: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        errorMessage: `분석 중 오류가 발생했습니다: ${error.message}`
      };
    }
  }

  /**
   * 이미지 리사이징 및 최적화 (얼굴 슬리밍과 동일한 로직)
   * 원본 비율 유지하면서 800px 기준으로 리사이징, EXIF 회전 정보 자동 적용
   * @param imageBuffer 원본 이미지 버퍼
   * @returns 최적화된 이미지 버퍼
   */
  private async resizeAndOptimizeImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // EXIF 회전 정보 먼저 적용
      const rotatedBuffer = await sharp(imageBuffer).rotate().toBuffer();
      const metadata = await sharp(rotatedBuffer).metadata();
      
      this.logger.log(`음식 이미지 정보: ${metadata.width}x${metadata.height}, EXIF 회전 적용`);
      
      // 긴 쪽이 800px를 넘으면 비율 유지하면서 리사이징
      const maxDimension = Math.max(metadata.width, metadata.height);
      
      if (maxDimension > 800) {
        const scaleFactor = 800 / maxDimension;
        const newWidth = Math.round(metadata.width * scaleFactor);
        const newHeight = Math.round(metadata.height * scaleFactor);
        
        this.logger.log(`음식 이미지 리사이징: ${metadata.width}x${metadata.height} → ${newWidth}x${newHeight} (비율 유지)`);
        
        return await sharp(rotatedBuffer)
          .resize(newWidth, newHeight, { 
            fit: 'inside', // 비율 유지하면서 리사이징
            withoutEnlargement: false
          })
          .jpeg({ 
            quality: 85,
            mozjpeg: true
          })
          .toBuffer();
      }

      // 800px 이하면 원본 크기 그대로 유지 (EXIF 회전만 적용 + JPEG 최적화)
      this.logger.log(`음식 이미지 크기 적절함: ${metadata.width}x${metadata.height} (EXIF 회전 + JPEG 최적화 적용)`);
      return await sharp(rotatedBuffer)
        .jpeg({ 
          quality: 85,
          mozjpeg: true
        })
        .toBuffer();

    } catch (error) {
      this.logger.warn('음식 이미지 리사이징 실패, 원본 사용:', error.message);
      return imageBuffer;
    }
  }

  /**
   * 이미지 버퍼에서 MIME 타입 감지
   * @param buffer 이미지 버퍼
   * @returns MIME 타입
   */
  private detectMimeType(buffer: Buffer): string {
    const header = buffer.subarray(0, 4).toString('hex');
    
    if (header.startsWith('89504e47')) return 'image/png';
    if (header.startsWith('ffd8ff')) return 'image/jpeg';
    if (header.startsWith('47494638')) return 'image/gif';
    if (header.startsWith('52494646')) return 'image/webp';
    
    // 기본값
    return 'image/jpeg';
  }

  /**
   * 서비스 상태 확인
   */
  isReady(): boolean {
    return !!this.openai;
  }

  /**
   * 모델 정보 조회
   */
  getModelInfo(): { ready: boolean; model: string; provider: string } {
    return {
      ready: this.isReady(),
      model: this.model,
      provider: 'OpenAI'
    };
  }
}