import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MatchingService } from './matching.service';

@ApiTags('matching')
@ApiBearerAuth()
@Controller('donations/:id')
export class MatchingController {
  constructor(private matching: MatchingService) {}

  @Get('recommended-ngos')
  @ApiOperation({ summary: 'AI-ranked nearby NGOs for a donation' })
  ngos(@Param('id', ParseUUIDPipe) id: string, @Query('maxKm') maxKm?: string) {
    return this.matching.recommendNgos(id, maxKm ? Number(maxKm) : 25);
  }

  @Get('recommended-volunteers')
  @ApiOperation({ summary: 'Available volunteers whose radius covers the pickup point' })
  volunteers(@Param('id', ParseUUIDPipe) id: string) {
    return this.matching.recommendVolunteers(id);
  }
}
