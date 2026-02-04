import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * AI 챗봇 채팅 요청 DTO
 * 프론트엔드에서 전송하는 채팅 메시지
 */
export class AiChatRequestDto {
  @ApiProperty({
    description: '사용자 채팅 메시지',
    example: '오늘 점심 뭐 먹는게 좋을까?',
    maxLength: 2000,
  })
  @IsNotEmpty({ message: '메시지를 입력해주세요.' })
  @IsString()
  @MaxLength(2000, { message: '메시지는 2000자 이내로 입력해주세요.' })
  message: string;
}

/**
 * AI Agent 서버 요청 DTO
 * AI Agent 서버로 전송하는 요청 페이로드
 */
export class AiAgentRequestDto {
  userId: number;
  chartId: string;
  message: string;
  personaId: number;
}

/**
 * AI Agent 서버 응답 DTO
 * AI Agent 서버에서 반환하는 응답
 */
export class AiAgentResponseDto {
  ai_message: string;
  chart_id: string;
  processing_time_ms: number;
}

/**
 * AI 챗봇 채팅 응답 DTO
 * 프론트엔드로 반환하는 응답
 */
export class AiChatResponseDto {
  @ApiProperty({
    description: 'AI 응답 메시지',
    example: '오늘 점심은 소화가 잘 되는 따뜻한 국물 요리를 추천드려요.',
  })
  aiMessage: string;

  @ApiProperty({
    description: '차트 ID',
    example: 'TA11150002',
  })
  chartId: string;

  @ApiProperty({
    description: 'AI 처리 시간 (밀리초)',
    example: 7365,
  })
  processingTimeMs: number;
}

/**
 * 채팅 내역 조회 요청 DTO
 * 역방향 페이지네이션 쿼리 파라미터
 */
export class ChatHistoryQueryDto {
  @ApiPropertyOptional({
    description: '페이지 번호 (1부터 시작, 최신 메시지부터)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '페이지당 메시지 수',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}

/**
 * 채팅 메시지 DTO
 * 개별 채팅 메시지 정보
 */
export class ChatMessageDto {
  @ApiProperty({
    description: '메시지 내용',
    example: '안녕! 오늘 뭐 먹었어?',
  })
  text: string;

  @ApiProperty({
    description: '사용자 메시지 여부 (true: 사용자, false: AI)',
    example: false,
  })
  isUser: boolean;

  @ApiProperty({
    description: '날짜 (한국어 형식)',
    example: '2026년 1월 7일',
  })
  date: string;

  @ApiProperty({
    description: '시간 (한국어 형식)',
    example: '오전 10:46',
  })
  time: string;

  @ApiPropertyOptional({
    description: 'AI 페르소나 이름 (AI 메시지일 경우에만)',
    example: '메이브',
    nullable: true,
  })
  personaName: string | null;
}

/**
 * 채팅 내역 데이터 DTO
 */
export class ChatHistoryDataDto {
  @ApiProperty({
    description: '채팅 메시지 목록',
    type: [ChatMessageDto],
  })
  messages: ChatMessageDto[];

  @ApiProperty({
    description: '현재 페이지 번호',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: '페이지당 메시지 수',
    example: 30,
  })
  limit: number;

  @ApiProperty({
    description: '총 페이지 수',
    example: 4,
  })
  totalPage: number;

  @ApiProperty({
    description: '마지막 페이지 여부 (더 이상 이전 메시지 없음)',
    example: false,
  })
  isEndOfPage: boolean;
}

/**
 * 채팅 내역 조회 응답 DTO
 */
export class ChatHistoryResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '채팅 내역 데이터',
    type: ChatHistoryDataDto,
  })
  data: ChatHistoryDataDto;
}
