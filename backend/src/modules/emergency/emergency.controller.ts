import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { EmergencyService } from './emergency.service';

class CreateEmergencyDto {
  @ApiProperty({ enum: ['cooked_meal', 'bakery', 'produce', 'dairy', 'packaged', 'other'] })
  @IsIn(['cooked_meal', 'bakery', 'produce', 'dairy', 'packaged', 'other'])
  foodCategory: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantityServings: number;

  @ApiProperty({ example: '2026-08-02T18:00:00Z' })
  @IsDateString()
  neededBy: string;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@ApiTags('emergency')
@ApiBearerAuth()
@Controller('emergency-requests')
export class EmergencyController {
  constructor(private emergency: EmergencyService) {}

  @Post()
  @Roles('ngo')
  @ApiOperation({ summary: 'Broadcast urgent food need to nearby donors' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmergencyDto) {
    return this.emergency.create(user, dto);
  }

  @Get()
  list(@Query('status') status?: string) {
    return this.emergency.list(status);
  }

  @Post(':id/status')
  @Roles('ngo')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'partially_filled' | 'fulfilled' | 'expired',
  ) {
    return this.emergency.updateStatus(user, id, status);
  }
}
