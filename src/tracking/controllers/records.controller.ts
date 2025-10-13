import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
  Delete,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RecordsService } from '../services/records.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RecordAccessGuard } from '../guards/record-access.guard';
import {
  CreateBeautyRecordDto,
  CreateDietRecordDto,
  CreateSupplementRecordDto,
  CreateFastingRecordDto,
  CreateSleepRecordDto,
  CreateActivityRecordDto,
  CreateCustomSupplementDto,
  CustomSupplementDto,
  RecordResponseDto,
  RecordListResponseDto,
} from '../dto/records/records.dto';

/**
 * 기록 컨트롤러
 * 사용자의 6가지 기록 유형 관리 (이너뷰티, 식단, 영양제, 공복, 수면, 활동)
 * 
 * 권한: 구독사용자 또는 챌린지활성자만 접근 가능
 */
@ApiTags('헬스케어-기록')
@Controller('tracking/records')
@UseGuards(JwtAuthGuard, RecordAccessGuard)
@ApiBearerAuth()
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  /**
   * 기록 목록 조회
   * @description 사용자의 기록 목록을 날짜별로 조회
   */
  @Get()
  @ApiOperation({
    summary: '기록 목록 조회',
    description: '사용자의 기록 목록을 날짜별로 조회합니다. 특정 날짜나 기록 유형으로 필터링 가능합니다.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: '조회할 날짜 (YYYY-MM-DD 형식, 기본값: 오늘)',
  })
  @ApiQuery({
    name: 'recordType',
    required: false,
    description: '기록 유형 (BEAUTY, DIET, SUPPLEMENT, FASTING, SLEEP, ACTIVITY)',
  })
  @ApiResponse({
    status: 200,
    description: '기록 목록 조회 성공',
    type: RecordListResponseDto,
  })
  async getRecords(
    @Request() req: any,
    @Query('date') date?: string,
    @Query('recordType') recordType?: string,
  ) {
    return this.recordsService.getRecords(req.user.id, { date, recordType });
  }

  /**
   * 이너뷰티 기록 저장
   * @description 설문식 이너뷰티 기록을 저장합니다 (5점 척도 × 5개 질문)
   */
  @Post('beauty')
  @ApiOperation({
    summary: '이너뷰티 기록 저장',
    description: '5가지 질문에 대한 5점 척도 응답을 기록합니다. 완료시 포인트 100점 지급',
  })
  @ApiResponse({
    status: 201,
    description: '이너뷰티 기록 저장 성공',
    type: RecordResponseDto,
  })
  async createBeautyRecord(
    @Request() req: any,
    @Body() createBeautyRecordDto: CreateBeautyRecordDto,
  ) {
    return this.recordsService.createBeautyRecord(req.user.id, createBeautyRecordDto);
  }

  /**
   * 식단 기록 저장
   * @description 아침/점심/저녁 시간과 섭취 식품을 기록합니다
   */
  @Post('diet')
  @ApiOperation({
    summary: '식단 기록 저장',
    description: '식사 시간(아침/점심/저녁)과 섭취한 식품들을 기록합니다. 완료시 포인트 100점 지급',
  })
  @ApiResponse({
    status: 201,
    description: '식단 기록 저장 성공',
    type: RecordResponseDto,
  })
  async createDietRecord(
    @Request() req: any,
    @Body() createDietRecordDto: CreateDietRecordDto,
  ) {
    return this.recordsService.createDietRecord(req.user.id, createDietRecordDto);
  }

  /**
   * 영양제 섭취 기록 저장
   * @description 개인 영양제 목록과 섭취 시간을 기록합니다
   */
  @Post('supplement')
  @ApiOperation({
    summary: '영양제 섭취 기록 저장',
    description: '개인 영양제 목록과 섭취 시간을 기록합니다. 완료시 포인트 100점 지급',
  })
  @ApiResponse({
    status: 201,
    description: '영양제 섭취 기록 저장 성공',
    type: RecordResponseDto,
  })
  async createSupplementRecord(
    @Request() req: any,
    @Body() createSupplementRecordDto: CreateSupplementRecordDto,
  ) {
    return this.recordsService.createSupplementRecord(req.user.id, createSupplementRecordDto);
  }

  /**
   * 간헐적 단식 기록 저장
   * @description 공복 시작시간과 종료시간을 기록합니다
   */
  @Post('fasting')
  @ApiOperation({
    summary: '간헐적 단식 기록 저장',
    description: '공복 시작시간과 종료시간을 기록합니다. 완료시 포인트 100점 지급',
  })
  @ApiResponse({
    status: 201,
    description: '간헐적 단식 기록 저장 성공',
    type: RecordResponseDto,
  })
  async createFastingRecord(
    @Request() req: any,
    @Body() createFastingRecordDto: CreateFastingRecordDto,
  ) {
    return this.recordsService.createFastingRecord(req.user.id, createFastingRecordDto);
  }

  /**
   * 수면 기록 저장
   * @description 잠든 시간과 기상 시간을 기록합니다
   */
  @Post('sleep')
  @ApiOperation({
    summary: '수면 기록 저장',
    description: '잠든 시간과 기상 시간을 기록합니다. 완료시 포인트 100점 지급',
  })
  @ApiResponse({
    status: 201,
    description: '수면 기록 저장 성공',
    type: RecordResponseDto,
  })
  async createSleepRecord(
    @Request() req: any,
    @Body() createSleepRecordDto: CreateSleepRecordDto,
  ) {
    return this.recordsService.createSleepRecord(req.user.id, createSleepRecordDto);
  }

  /**
   * 활동 기록 저장
   * @description 운동 종목과 시간을 기록합니다
   */
  @Post('activity')
  @ApiOperation({
    summary: '활동 기록 저장',
    description: '다양한 운동 종목과 운동 시간을 기록합니다. 완료시 포인트 100점 지급',
  })
  @ApiResponse({
    status: 201,
    description: '활동 기록 저장 성공',
    type: RecordResponseDto,
  })
  async createActivityRecord(
    @Request() req: any,
    @Body() createActivityRecordDto: CreateActivityRecordDto,
  ) {
    return this.recordsService.createActivityRecord(req.user.id, createActivityRecordDto);
  }

  /**
   * 영양제 목록 조회 (상품 + 커스텀)
   * @description 영양제 기록에서 선택할 수 있는 영양제 목록을 조회합니다
   */
  @Get('supplements')
  @ApiOperation({
    summary: '영양제 목록 조회',
    description: '영양제 기록에서 선택할 수 있는 상품 영양제와 커스텀 영양제 목록을 조회합니다',
  })
  @ApiResponse({
    status: 200,
    description: '영양제 목록 조회 성공',
  })
  async getSupplementList(@Request() req: any) {
    return this.recordsService.getSupplementList(req.user.id);
  }

  /**
   * 커스텀 영양제 생성
   * @description 사용자가 직접 영양제를 추가합니다
   */
  @Post('supplements/custom')
  @ApiOperation({
    summary: '커스텀 영양제 생성',
    description: '사용자가 직접 영양제를 추가합니다',
  })
  @ApiResponse({
    status: 201,
    description: '커스텀 영양제 생성 성공',
    type: CustomSupplementDto,
  })
  async createCustomSupplement(
    @Request() req: any,
    @Body() createCustomSupplementDto: CreateCustomSupplementDto,
  ) {
    return this.recordsService.createCustomSupplement(req.user.id, createCustomSupplementDto);
  }

  /**
   * 커스텀 영양제 삭제
   * @description 사용자의 커스텀 영양제를 삭제합니다
   */
  @Delete('supplements/custom/:id')
  @ApiOperation({
    summary: '커스텀 영양제 삭제',
    description: '사용자의 커스텀 영양제를 삭제합니다',
  })
  @ApiResponse({
    status: 200,
    description: '커스텀 영양제 삭제 성공',
  })
  async deleteCustomSupplement(
    @Request() req: any,
    @Param('id', ParseIntPipe) supplementId: number,
  ) {
    await this.recordsService.deleteCustomSupplement(req.user.id, supplementId);
    return { success: true, message: '커스텀 영양제가 삭제되었습니다.' };
  }

  /**
   * 운동 종목 목록 조회
   * @description 활동 기록에서 선택할 수 있는 운동 종목 목록을 조회합니다
   */
  @Get('exercise-types')
  @ApiOperation({
    summary: '운동 종목 목록 조회',
    description: '활동 기록에서 선택할 수 있는 운동 종목 목록을 조회합니다',
  })
  @ApiResponse({
    status: 200,
    description: '운동 종목 목록 조회 성공',
  })
  async getExerciseTypes(@Request() req: any) {
    return this.recordsService.getExerciseTypes();
  }
}