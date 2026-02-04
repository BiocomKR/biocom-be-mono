import { IsOptional, IsString, IsNumber, IsObject, ValidateIf, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * recordType으로 미션 제출 요청 DTO
 * challengeMissionId 없이 recordType만으로 미션 제출
 */
export class SubmitMissionByTypeDto {
  @ApiProperty({
    description: '미션 기록 타입',
    example: 'DECLARATION',
    enum: ['DECLARATION', 'SELF_PRAISE']
  })
  @IsString({ message: 'recordType은 문자열이어야 합니다' })
  recordType: string;

  @ApiProperty({
    description: '메타데이터 - TEXT 미션의 경우 { text: "내용" }, PHOTO 미션의 경우 { fileUploadId: 123 }',
    example: { text: '나는 21일 동안 건강한 습관을 실천하겠습니다.' }
  })
  @IsObject({ message: '메타데이터는 객체여야 합니다' })
  metadata: {
    text?: string;
    fileUploadId?: number;
  };
}

/**
 * 미션 완료 요청 DTO
 */
export class CompleteMissionDto {
  @ApiProperty({
    description: '챌린지 미션 ID (필수)',
    example: 123
  })
  @IsNumber({}, { message: '챌린지 미션 ID는 숫자여야 합니다' })
  challengeMissionId: number;

  @ApiProperty({
    description: '데일리 미션 ID (선택) - daily_missions 테이블의 ID. 1일1미션 같은 경우에만 필요',
    example: 45,
    required: false
  })
  @IsOptional()
  @IsNumber({}, { message: '데일리 미션 ID는 숫자여야 합니다' })
  dailyMissionId?: number;

  @ApiProperty({
    description: '메타데이터 (선택) - verifyType에 따라 다른 데이터 포함. PHOTO: {fileUploadId}, TEXT: {text}, 기록형: {value, unit} 등',
    example: { fileUploadId: 12 },
    required: false,
    examples: {
      photo: {
        value: { fileUploadId: 12 },
        description: 'PHOTO 타입 - 파일 업로드 ID'
      },
      text: {
        value: { text: '오늘 아침 7시에 일어났습니다.' },
        description: 'TEXT 타입 - 텍스트 입력'
      },
      both: {
        value: { fileUploadId: 12, text: '사진과 함께 한마디' },
        description: 'BOTH 타입 - 파일과 텍스트 모두'
      },
      tracking: {
        value: { value: '8', unit: '시간' },
        description: '기록형 미션 - 수치 기록'
      },
      meal: {
        value: {
          mealType: 'breakfast',
          time: '08:20',
          menu: '샐러드',
          calories: 300
        },
        description: '식단 기록'
      }
    }
  })
  @IsOptional()
  @IsObject({ message: '메타데이터는 객체여야 합니다' })
  metadata?: any;
}

/**
 * 미션 완료 응답 DTO
 */
export class MissionCompletionResponseDto {
  @ApiProperty({
    description: '완료된 미션 정보'
  })
  mission: {
    id: number;
    name: string;
    type: string;
    points: number;
  };

  @ApiProperty({
    description: '획득 포인트',
    example: 100
  })
  pointsEarned: number;

  @ApiProperty({
    description: '완료 일시'
  })
  completedAt: Date;

  @ApiProperty({
    description: '생성된 기록 ID (기록형 미션의 경우)',
    required: false
  })
  trackingRecordId?: number;

  @ApiProperty({
    description: '오늘의 진행 상황 업데이트'
  })
  todayProgress: {
    missionsCompleted: number;
    pointsEarned: number;
  };
}