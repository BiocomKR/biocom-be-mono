import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  RequestVerificationDto,
  RequestVerificationResponseDto,
  VerifyOtpDto,
  VerifyOtpResponseDto,
} from './dto';
import { PhoneVerificationService } from './phone-verification.service';

/**
 * 휴대폰 본인인증 컨트롤러
 * - 본인인증요청: KCP 1단계(실명확인) + 2단계(SMS발송) 자동 연속 처리
 * - 인증번호검증: KCP 3단계(OTP확인) 처리
 */
@ApiTags('휴대폰 본인인증')
@Controller('phone-verification')
export class PhoneVerificationController {
  constructor(
    private readonly phoneVerificationService: PhoneVerificationService,
  ) {}

  /**
   * 본인인증 요청
   * - KCP 1단계(실명확인) 호출 → DB 저장 → KCP 2단계(SMS발송) 자동 호출
   * - 성공 시 per_cert_no 반환 (3단계에서 사용)
   */
  @Post('request')
  @ApiOperation({
    summary: '본인인증 요청',
    description:
      '본인 정보를 검증하고 SMS를 자동으로 발송합니다. 반환된 certNumber를 저장하여 인증번호 검증 시 사용하세요.',
  })
  @ApiResponse({
    status: 201,
    description: '본인인증 요청 성공 (SMS 발송 완료)',
    type: RequestVerificationResponseDto,
  })
  async requestVerification(
    @Body() dto: RequestVerificationDto,
  ): Promise<RequestVerificationResponseDto> {
    return this.phoneVerificationService.requestVerification(dto);
  }

  /**
   * 인증번호 검증
   * - KCP 3단계(OTP확인) 호출
   * - 성공 시 CI/DI 값 반환
   */
  @Post('verify')
  @ApiOperation({
    summary: '인증번호 검증',
    description:
      'SMS로 받은 인증번호를 검증하여 본인인증을 완료합니다. 성공 시 CI/DI 값을 반환합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '본인인증 완료',
    type: VerifyOtpResponseDto,
  })
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    return this.phoneVerificationService.verifyOtp(dto);
  }
}
