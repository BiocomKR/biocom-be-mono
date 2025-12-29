import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SolutionService } from './solution.service';
import { SolutionResponseDto } from './dto/solution.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 맞춤 솔루션 컨트롤러
 * 건강유형별 영양제/식단 추천 API
 */
@ApiTags('맞춤솔루션')
@Controller('solution')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SolutionController {
  constructor(private readonly solutionService: SolutionService) {}

  /**
   * 맞춤 솔루션 전체 데이터 조회
   * @description 사용자의 건강유형에 맞는 영양제/식단 추천 데이터를 한 번에 반환합니다
   */
  @Get()
  @ApiOperation({
    summary: '맞춤 솔루션 조회',
    description: `
사용자의 건강유형에 맞는 영양제/식단 추천 데이터를 통합 반환합니다.

## 응답 구조
- **animal**: 건강유형 동물 정보 (펭귄, 고슴도치 등)
- **supplements**: 영양제 추천 (core/plus/condition 탭)
- **diets**: 식단 추천 (core/plus/condition 탭)
- **lineups**: 라인업 목록 (오리지널, 시그니처, 저속노화, 저포드맵)
- **allergens**: 알레르겐 목록 (필터링용)
- **conditionalProducts**: 조건부 추천 (메타드림/리셋데이)

## 탭 구분
- **core**: 핵심 추천 (priority=1)
- **plus**: 추가 추천 (priority=2)
- **condition**: 상황별 추천 (priority=3)
    `,
  })
  @ApiResponse({
    status: 200,
    description: '맞춤 솔루션 조회 성공',
    type: SolutionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '건강유형이 설정되지 않음 (검사 미완료)',
  })
  async getSolution(@Request() req: any): Promise<SolutionResponseDto> {
    const userId = req.user?.userId || req.user?.sub;
    return this.solutionService.getSolution(userId);
  }
}
