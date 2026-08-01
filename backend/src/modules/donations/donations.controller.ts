import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { DonationsService } from './donations.service';
import { CreateDonationDto, ListDonationsQueryDto } from './dto/donations.dto';

@ApiTags('donations')
@ApiBearerAuth()
@Controller('donations')
export class DonationsController {
  constructor(private donations: DonationsService) {}

  @Post()
  @Roles('donor')
  @ApiOperation({ summary: 'List surplus food (AI fills pickup window)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDonationDto) {
    return this.donations.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Browse donations (filters: status, category, near=lat,lng,km)' })
  list(@Query() query: ListDonationsQueryDto) {
    return this.donations.list(query);
  }

  @Get('mine')
  @Roles('donor')
  listMine(@CurrentUser() user: AuthUser) {
    return this.donations.listMine(user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.donations.getById(id);
  }

  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.donations.statusHistory(id);
  }

  @Post(':id/claim')
  @Roles('ngo')
  @ApiOperation({ summary: 'NGO claims a listed donation' })
  claim(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.donations.claim(user, id);
  }

  @Post(':id/cancel')
  @Roles('donor', 'ngo')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('note') note?: string,
  ) {
    return this.donations.cancel(user, id, note);
  }
}
