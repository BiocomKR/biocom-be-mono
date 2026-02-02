import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SolutionService } from './solution.service';
import { DietSolutionResponseDto, SupplementSolutionResponseDto } from './dto/solution.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 맞춤 솔루션 컨트롤러
 * 식단/영양제 분리 API
 */
@ApiTags('맞춤솔루션')
@Controller('solution')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SolutionController {
  constructor(private readonly solutionService: SolutionService) {}

  /**
   * 식단 솔루션 조회
   */
  @Get('diet')
  @ApiOperation({
    summary: '식단 솔루션 조회',
    description: `
사용자의 건강유형에 맞는 식단 추천 데이터를 반환합니다.

## 응답 구조
- **animal**: 건강유형 동물 정보
- **lineups**: 라인업 목록 (동물별 설명, 우선순위 포함)
- **diets**: 식단 추천 목록
- **dietGuide**: 식단 섭취 가이드 (루틴/시너지)
    `,
  })
  @ApiResponse({
    status: 200,
    description: '식단 솔루션 조회 성공',
    type: DietSolutionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '건강유형이 설정되지 않음',
  })
  async getDietSolution(@Request() req: any): Promise<DietSolutionResponseDto> {
    const userId = req.user?.userId || req.user?.sub;
    return this.solutionService.getDietSolution(userId);
  }

  /**
   * 영양제 솔루션 조회
   */
  @Get('supplement')
  @ApiOperation({
    summary: '영양제 솔루션 조회',
    description: `
사용자의 건강유형에 맞는 영양제 추천 데이터를 반환합니다.

## 응답 구조
- **animal**: 건강유형 동물 정보
- **supplements**: 영양제 추천 목록 (맞춤 포뮬러 + 단품)
- **formulaGuide**: 맞춤 포뮬러 설명
- **conditionalProducts**: 조건부 추천 (메타드림/리셋데이)
    `,
  })
  @ApiResponse({
    status: 200,
    description: '영양제 솔루션 조회 성공',
    type: SupplementSolutionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '건강유형이 설정되지 않음',
  })
  async getSupplementSolution(@Request() req: any): Promise<SupplementSolutionResponseDto> {
    const userId = req.user?.userId || req.user?.sub;
    return this.solutionService.getSupplementSolution(userId);
  }
}
