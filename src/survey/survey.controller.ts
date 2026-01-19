import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  ParseIntPipe,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SurveyService } from './survey.service';
import { CreateSurveyQuestionDto } from './create-survey-question.dto';
import { CreateSurveyOptionDto } from './create-survey-option.dto';
import {
  SurveyQuestionResponseDto,
  SurveyOptionResponseDto,
  SurveyAnswerResponseDto,
} from './survey-response.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';
import * as ExcelJS from 'exceljs';
import * as dayjs from 'dayjs';

/**
 * Management 설문 관리 컨트롤러
 * 백오피스에서 설문을 관리하는 API
 */
@ApiTags('설문 관리')
@ApiBearerAuth()
@Controller('survey')
@UseGuards(JwtAuthGuard)
export class SurveyController {
  private readonly logger = new Logger(SurveyController.name);

  constructor(private readonly managementSurveyService: SurveyService) {}

  /**
   * 모든 설문 목록 조회 (페이징 및 필터링)
   */
  @Get()
                      async getAllSurveys(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('설문 목록 조회 요청');

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      // 필터 조건 구성
      const filters = {
        search,
        type,
        category,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      };

      // 정렬 조건
      const sort = {
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      };

      const result = await this.managementSurveyService.getSurveysWithPagination(
        pageNum,
        limitNum,
        filters,
        sort,
      );
      
      this.logger.log(`설문 목록 조회 성공 - 총 ${result.total}개, 페이지 ${result.page}/${result.totalPages}`);
      
      return {
        success: true,
        message: '설문 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error('설문 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 질문 목록 조회 (페이징) - 정적 라우트를 :id 보다 먼저 선언
   */
  @Get('questions')
  async getQuestions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('surveyId') surveyId?: string,
    @Query('categoryCode') categoryCode?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('질문 목록 조회 요청');

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      const filters = {
        surveyId: surveyId ? parseInt(surveyId, 10) : undefined,
        categoryCode,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search,
      };

      const sort = {
        sortBy: sortBy || 'sortOrder',
        sortOrder: (sortOrder || 'asc') as 'asc' | 'desc',
      };

      const result = await this.managementSurveyService.getQuestionsWithPagination(
        pageNum,
        limitNum,
        filters,
        sort,
      );

      this.logger.log(`질문 목록 조회 성공 - 총 ${result.total}개`);

      return {
        success: true,
        message: '질문 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error('질문 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 설문 답변 목록 조회 (페이징 및 필터링) - 정적 라우트를 :id 보다 먼저 선언
   */
  @Get('answers')
  async getAnswers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('surveyId') surveyId?: string,
    @Query('type') type?: string,
    @Query('categoryCode') categoryCode?: string,
    @Query('userId') userId?: string,
    @Query('userChallengeId') userChallengeId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('설문 답변 목록 조회 요청');

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      const filters = {
        surveyId: surveyId ? parseInt(surveyId, 10) : undefined,
        type,
        categoryCode,
        userId: userId ? parseInt(userId, 10) : undefined,
        userChallengeId: userChallengeId ? parseInt(userChallengeId, 10) : undefined,
        search,
        startDate,
        endDate,
        excludeTesters: excludeTesters === 'true',
      };

      const sort = {
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      };

      const result = await this.managementSurveyService.getAnswersWithPagination(
        pageNum,
        limitNum,
        filters,
        sort,
      );

      this.logger.log(`설문 답변 목록 조회 성공 - 총 ${result.total}개`);

      return {
        success: true,
        message: '설문 답변 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error('설문 답변 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 설문 답변 엑셀 다운로드
   */
  @Get('answers/excel')
  async downloadAnswersExcel(
    @Res() res: Response,
    @Query('productId') productId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    this.logger.log(`설문 답변 엑셀 다운로드 요청 - productId: ${productId}, excludeTesters: ${excludeTesters}`);

    const data = await this.managementSurveyService.getAnswersForExcel({
      productId: productId ? parseInt(productId, 10) : undefined,
      startDate,
      endDate,
      excludeTesters: excludeTesters === 'true',
    });

    const workbook = new ExcelJS.Workbook();

    // 단일 시트: 이름, 챌린지명, 구분, 질문, 답변, 점수
    const sheet = workbook.addWorksheet('문진답변');
    sheet.columns = [
      { header: '이름', key: 'userName', width: 12 },
      { header: '연락처', key: 'userMobile', width: 15 },
      { header: '챌린지', key: 'productName', width: 25 },
      { header: '구분', key: 'type', width: 10 },
      { header: '카테고리', key: 'category', width: 15 },
      { header: '질문', key: 'questionText', width: 50 },
      { header: '답변', key: 'optionText', width: 25 },
      { header: '점수', key: 'score', width: 8 },
      { header: '답변일시', key: 'createdAt', width: 18 },
    ];

    // 데이터 추가
    data.rawData.forEach((item) => {
      sheet.addRow({
        userName: item.userName,
        userMobile: item.userMobile,
        productName: item.productName,
        type: item.type === 'before' || item.type === 'BEFORE' ? '사전문진' : '사후문진',
        category: item.category,
        questionText: item.questionText,
        optionText: item.optionText,
        score: item.score,
        createdAt: dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      });
    });

    // 헤더 스타일
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // 자동 필터 설정 (전체 데이터 범위)
    const lastRow = data.rawData.length + 1;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastRow, column: 9 },
    };

    // 첫 행 고정
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // 응답 전송
    const fileName = `설문답변_${dayjs().format('YYYYMMDD_HHmmss')}`;
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}.xlsx`);
    await workbook.xlsx.write(res);

    this.logger.log(`설문 답변 엑셀 다운로드 완료 - ${data.rawData.length}건`);
  }

  /**
   * 선택지 목록 조회 - 정적 라우트를 :id 보다 먼저 선언
   */
  @Get('options')
  async getOptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('선택지 목록 조회 요청');

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      const result = await this.managementSurveyService.getOptionsWithPagination(pageNum, limitNum);

      this.logger.log(`선택지 목록 조회 성공 - 총 ${result.total}개`);

      return {
        success: true,
        message: '선택지 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error('선택지 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 새로운 설문 생성
   */
  @Post()
  async createSurvey(
    @Body() createSurveyDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문 생성 요청 - 이름: ${createSurveyDto.name}`);

    try {
      const survey = await this.managementSurveyService.createSurvey(createSurveyDto);

      this.logger.log(`설문 생성 성공 - ID: ${survey.id}`);

      return {
        success: true,
        message: '설문이 성공적으로 생성되었습니다.',
        data: survey,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 생성 실패 - 이름: ${createSurveyDto.name}`, error);
      throw error;
    }
  }

  /**
   * 설문 상세 조회 - 동적 라우트는 정적 라우트 뒤에 선언
   */
  @Get(':id')
  async getSurvey(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문 상세 조회 요청 - ID: ${id}`);

    try {
      const survey = await this.managementSurveyService.getSurveyById(id);

      this.logger.log(`설문 상세 조회 성공 - ID: ${id}`);

      return {
        success: true,
        message: '설문이 성공적으로 조회되었습니다.',
        data: survey,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 상세 조회 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 설문 수정
   */
  @Put(':id')
          async updateSurvey(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSurveyDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문 수정 요청 - ID: ${id}`);

    try {
      const survey = await this.managementSurveyService.updateSurvey(id, updateSurveyDto);
      
      this.logger.log(`설문 수정 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '설문이 성공적으로 수정되었습니다.',
        data: survey,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 수정 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 설문 삭제
   */
  @Delete(':id')
        async deleteSurvey(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<null>> {
    this.logger.log(`설문 삭제 요청 - ID: ${id}`);

    try {
      await this.managementSurveyService.deleteSurvey(id);
      
      this.logger.log(`설문 삭제 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '설문이 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 삭제 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 설문에 질문 추가
   */
  @Post(':id/questions')
          async addQuestionToSurvey(
    @Param('id', ParseIntPipe) surveyId: number,
    @Body() createQuestionDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문에 질문 추가 요청 - 설문 ID: ${surveyId}, 질문: ${createQuestionDto.questionText}`);

    try {
      const question = await this.managementSurveyService.addQuestionToSurvey(surveyId, createQuestionDto);
      
      this.logger.log(`설문에 질문 추가 성공 - 질문 ID: ${question.id}`);
      
      return {
        success: true,
        message: '질문이 설문에 성공적으로 추가되었습니다.',
        data: question,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문에 질문 추가 실패 - 설문 ID: ${surveyId}`, error);
      throw error;
    }
  }

  /**
   * 새로운 설문 질문 생성
   */
  @Post('questions')
        async createQuestion(
    @Body() createSurveyQuestionDto: CreateSurveyQuestionDto,
  ): Promise<ApiResponseDto<SurveyQuestionResponseDto>> {
    this.logger.log(`설문 질문 생성 요청 - 질문: ${createSurveyQuestionDto.questionText}`);

    try {
      const question = await this.managementSurveyService.createQuestion(createSurveyQuestionDto);
      
      this.logger.log(`설문 질문 생성 응답 성공 - ID: ${question.id}`);
      
      return {
        success: true,
        message: '설문 질문이 성공적으로 생성되었습니다.',
        data: question,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 질문 생성 응답 실패 - 질문: ${createSurveyQuestionDto.questionText}`, error);
      throw error;
    }
  }

  /**
   * 새로운 설문 선택지 생성
   */
  @Post('options')
        async createOption(
    @Body() createSurveyOptionDto: CreateSurveyOptionDto,
  ): Promise<ApiResponseDto<SurveyOptionResponseDto>> {
    this.logger.log(`설문 선택지 생성 요청 - 질문 ID: ${createSurveyOptionDto.surveyQuestionId}`);

    try {
      const option = await this.managementSurveyService.createOption(createSurveyOptionDto);
      
      this.logger.log(`설문 선택지 생성 응답 성공 - ID: ${option.id}`);
      
      const responseDto = {
        id: option.id,
        surveyQuestionId: createSurveyOptionDto.surveyQuestionId,
        optionText: option.optionText,
        score: option.score,
        createdAt: option.createdAt,
        updatedAt: option.createdAt,
      };
      
      return {
        success: true,
        message: '설문 선택지가 성공적으로 생성되었습니다.',
        data: responseDto,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 선택지 생성 응답 실패 - 질문 ID: ${createSurveyOptionDto.surveyQuestionId}`, error);
      throw error;
    }
  }

  /**
   * 특정 질문에 대한 모든 답변 조회
   */
  @Get('answers/question/:questionId')
  async findAnswersByQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Query('type') type?: 'before' | 'after',
  ): Promise<ApiResponseDto<SurveyAnswerResponseDto[]>> {
    this.logger.log(`질문별 설문 답변 조회 요청 - 질문 ID: ${questionId}, 타입: ${type || '전체'}`);

    try {
      const answers = await this.managementSurveyService.findAnswersByQuestion(questionId, type);

      this.logger.log(`질문별 설문 답변 조회 응답 성공 - 질문 ID: ${questionId}, 답변 수: ${answers.length}`);

      return {
        success: true,
        message: '질문에 대한 모든 답변이 성공적으로 조회되었습니다.',
        data: answers,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`질문별 설문 답변 조회 응답 실패 - 질문 ID: ${questionId}`, error);
      throw error;
    }
  }

  /**
   * 사용자별 설문 답변 조회
   */
  @Get('answers/user/:userId')
  async getAnswersByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('surveyId') surveyId?: string,
    @Query('type') type?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`사용자별 설문 답변 조회 요청 - userId: ${userId}`);

    try {
      const result = await this.managementSurveyService.getAnswersByUser(
        userId,
        surveyId ? parseInt(surveyId, 10) : undefined,
        type,
      );

      this.logger.log(`사용자별 설문 답변 조회 성공 - userId: ${userId}`);

      return {
        success: true,
        message: '사용자별 설문 답변이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`사용자별 설문 답변 조회 실패 - userId: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 챌린지별 설문 답변 조회 (사전/사후 비교)
   */
  @Get('answers/challenge/:userChallengeId')
  async getAnswersByChallenge(
    @Param('userChallengeId', ParseIntPipe) userChallengeId: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`챌린지별 설문 답변 조회 요청 - userChallengeId: ${userChallengeId}`);

    try {
      const result = await this.managementSurveyService.getAnswersByChallenge(userChallengeId);

      this.logger.log(`챌린지별 설문 답변 조회 성공 - userChallengeId: ${userChallengeId}`);

      return {
        success: true,
        message: '챌린지별 설문 답변이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`챌린지별 설문 답변 조회 실패 - userChallengeId: ${userChallengeId}`, error);
      throw error;
    }
  }

  /**
   * 설문 답변 통계 조회
   */
  @Get(':id/statistics')
  async getAnswerStatistics(
    @Param('id', ParseIntPipe) surveyId: number,
    @Query('type') type?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ): Promise<ApiResponseDto<any>> {
    const exclude = excludeTesters === 'true';
    this.logger.log(`설문 답변 통계 조회 요청 - surveyId: ${surveyId}, type: ${type || '전체'}, excludeTesters: ${exclude}`);

    try {
      const statistics = await this.managementSurveyService.getAnswerStatistics(surveyId, type, exclude);

      this.logger.log(`설문 답변 통계 조회 성공 - surveyId: ${surveyId}`);

      return {
        success: true,
        message: '설문 답변 통계가 성공적으로 조회되었습니다.',
        data: statistics,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 답변 통계 조회 실패 - surveyId: ${surveyId}`, error);
      throw error;
    }
  }

  /**
   * 질문 수정
   */
  @Put('questions/:id')
  async updateQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: {
      category?: string;
      categoryCode?: string;
      questionText?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`질문 수정 요청 - ID: ${id}`);

    try {
      const question = await this.managementSurveyService.updateQuestion(id, updateData);

      this.logger.log(`질문 수정 성공 - ID: ${id}`);

      return {
        success: true,
        message: '질문이 성공적으로 수정되었습니다.',
        data: question,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`질문 수정 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 질문 삭제
   */
  @Delete('questions/:id')
  async deleteQuestion(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<null>> {
    this.logger.log(`질문 삭제 요청 - ID: ${id}`);

    try {
      await this.managementSurveyService.deleteQuestion(id);

      this.logger.log(`질문 삭제 성공 - ID: ${id}`);

      return {
        success: true,
        message: '질문이 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`질문 삭제 실패 - ID: ${id}`, error);
      throw error;
    }
  }
}