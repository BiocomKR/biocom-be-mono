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
  RecordResponseDto,
  RecordListResponseDto,
} from '../dto/records/records.dto';
import { SupplementRoutineResponseDto } from '../dto/supplement-routine-response.dto';
import { SaveSupplementIntakeDto } from '../dto/supplement-intake.dto';
import {
  SupplementRoutineEditItemDto,
  SaveSupplementRoutineDto,
} from '../dto/supplement-routine-edit.dto';

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
    description: '사용자의 기록 목록을 날짜별로 조회합니다. 특정 날짜나 기록 유형으로 필터링 가능합니다. NEWCOMER는 예시 데이터 제공',
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
    return this.recordsService.getRecords(
      req.user.id,
      { date, recordType },
      req.isNewcomer || false, // Guard에서 설정한 플래그 전달
    );
  }

  /**
   * 뷰티 설문지 조회
   * @description 뷰티 설문지 질문 목록을 조회합니다 (이너뷰티 4개 + 아우터뷰티 4개)
   */
  @Get('beauty/questions')
  @ApiOperation({
    summary: '뷰티 설문지 조회',
    description: '뷰티 기록 작성에 필요한 설문지 질문 목록을 조회합니다. 이너뷰티 4개 항목과 아우터뷰티 4개 항목으로 구성됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '뷰티 설문지 조회 성공',
  })
  async getBeautyQuestions() {
    return this.recordsService.getBeautyQuestions();
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
   * 식단 초기 데이터 조회
   * @description 사용자의 지연성알러지 검사 결과를 바탕으로 알러지 식품, 고포드맵 식품, 가공식품 목록을 조회합니다
   */
  @Get('diet/init')
  @ApiOperation({
    summary: '식단 초기 데이터 조회',
    description: '사용자의 지연성알러지 검사 결과를 바탕으로 알러지 식품, 고포드맵 식품, 가공식품 목록을 조회합니다',
  })
  @ApiResponse({
    status: 200,
    description: '식단 초기 데이터 조회 성공',
  })
  async getDietInitData(@Request() req: any) {
    return this.recordsService.getDietInitData(req.user.id);
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
   * 영양제 목록 조회 (상품만)
   * @description 영양제 기록에서 선택할 수 있는 영양제 목록을 조회합니다
   */
  @Get('supplements')
  @ApiOperation({
    summary: '영양제 목록 조회',
    description: '영양제 기록에서 선택할 수 있는 상품 영양제 목록을 조회합니다',
  })
  @ApiResponse({
    status: 200,
    description: '영양제 목록 조회 성공',
  })
  async getSupplementList(@Request() req: any) {
    return this.recordsService.getSupplementList(req.user.id);
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

  /**
   * 내 영양제 루틴 조회
   * @description user_supplement_routine 테이블과 products 테이블을 조인하여 사용자의 영양제 루틴 목록을 조회합니다
   */
  @Get('supplements/routine')
  @ApiOperation({
    summary: '내 영양제 루틴 조회',
    description: '사용자의 맞춤 영양제 루틴 목록을 조회합니다. 설문조사 결과로 할당된 동물 타입 기반 영양제와 사용자가 추가한 영양제가 포함됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '영양제 루틴 조회 성공',
    type: [SupplementRoutineResponseDto],
  })
  async getSupplementRoutine(@Request() req: any) {
    return this.recordsService.getSupplementRoutine(req.user.id);
  }

  /**
   * 루틴 편집 화면용 전체 영양제 목록 조회
   * @description 전체 영양제 목록과 내 루틴 포함 여부를 조회합니다. 정렬: 1) 내 루틴, 2) 메타드림/리셋데이, 3) 나머지 ㄱㄴㄷ순
   */
  @Get('supplements/routine/edit')
  @ApiOperation({
    summary: '루틴 편집 화면용 영양제 목록 조회',
    description: '루틴 편집 화면에서 사용할 전체 영양제 목록을 조회합니다. 내 루틴 포함 여부와 기본 영양제 여부가 표시되며, 정렬 순서는 1) 내 루틴, 2) 메타드림/리셋데이, 3) 나머지 ㄱㄴㄷ순입니다.',
  })
  @ApiResponse({
    status: 200,
    description: '영양제 목록 조회 성공',
    type: [SupplementRoutineEditItemDto],
  })
  async getSupplementRoutineForEdit(@Request() req: any) {
    return this.recordsService.getSupplementRoutineForEdit(req.user.id);
  }

  /**
   * 영양제 루틴 저장 (추가/삭제)
   * @description 사용자 추가 영양제를 저장합니다. 기본 영양제는 자동으로 유지됩니다.
   */
  @Post('supplements/routine/edit')
  @ApiOperation({
    summary: '영양제 루틴 저장',
    description: '사용자 추가 영양제를 저장합니다. 기본 영양제(isDefault=true)는 자동 유지되며, 사용자가 선택한 영양제만 추가/삭제됩니다.',
  })
  @ApiResponse({
    status: 201,
    description: '영양제 루틴 저장 성공',
  })
  async saveSupplementRoutine(
    @Request() req: any,
    @Body() saveSupplementRoutineDto: SaveSupplementRoutineDto,
  ) {
    return this.recordsService.saveSupplementRoutine(
      req.user.id,
      saveSupplementRoutineDto.productIds,
    );
  }

  /**
   * 영양제 섭취 기록 저장
   * @description 여러 영양제의 아침/점심/저녁 섭취 여부를 한 번에 저장합니다
   */
  @Post('supplements/intake')
  @ApiOperation({
    summary: '영양제 섭취 기록 저장',
    description: '여러 영양제의 아침/점심/저녁 섭취 여부를 한 번에 저장합니다. 당일 최초 기록 시 사진 업로드 필수이며 포인트 100점이 지급됩니다.',
  })
  @ApiResponse({
    status: 201,
    description: '영양제 섭취 기록 저장 성공',
  })
  async saveSupplementIntake(
    @Request() req: any,
    @Body() saveSupplementIntakeDto: SaveSupplementIntakeDto,
  ) {
    return this.recordsService.saveSupplementIntake(req.user.id, saveSupplementIntakeDto);
  }
}