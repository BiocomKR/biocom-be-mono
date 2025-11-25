import { PartialType } from '@nestjs/swagger';
import { CreateScheduleDto } from './create-schedule.dto';

/**
 * 스케줄 수정 DTO
 *
 * CreateScheduleDto의 모든 필드를 optional로 만듦
 */
export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {}
