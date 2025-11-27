import { IsString, IsOptional, IsInt, IsObject } from 'class-validator';

export class CreateAppEventDto {
  @IsString()
  eventName: string;

  @IsOptional()
  @IsInt()
  userId?: number;

  @IsString()
  platform: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}
