import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HealthTypeAnimalService } from './health-type-animal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HealthTypeAnimalListResponseDto } from './dto/health-type-animal.dto';

@ApiTags('건강타입 동물')
@Controller('health-type-animals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HealthTypeAnimalController {
  constructor(private readonly healthTypeAnimalService: HealthTypeAnimalService) {}

  /**
   * 동물 목록 조회
   * 로그인한 사용자의 경우 내 동물(isMine) 표시
   */
  @Get()
  @ApiOperation({
    summary: '동물 목록 조회',
    description: '전체 동물 목록을 조회합니다. 로그인한 사용자의 동물은 isMine=true로 표시됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '동물 목록 조회 성공',
    type: HealthTypeAnimalListResponseDto,
  })
  async getAnimalList(@Request() req: any) {
    const data = await this.healthTypeAnimalService.getAnimalList(req.user?.id);
    return {
      success: true,
      data,
      message: '동물 목록 조회 성공',
    };
  }
}
