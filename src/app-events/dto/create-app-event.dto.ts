import { IsString, IsOptional, IsInt, IsObject } from 'class-validator';

export class CreateAppEventDto {
  @IsString()
  eventName: string;

  @IsOptional()
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}
