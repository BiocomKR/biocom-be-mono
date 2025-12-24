import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
