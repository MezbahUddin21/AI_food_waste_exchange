import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('summary')
  summary() {
    return this.analytics.summary();
  }

  @Get('trends')
  trends(@Query('days') days?: string) {
    return this.analytics.trends(days ? Number(days) : 30);
  }

  @Get('leaderboard')
  leaderboard() {
    return this.analytics.leaderboard();
  }
}
