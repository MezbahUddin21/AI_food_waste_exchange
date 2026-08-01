import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { AssignmentsService } from './assignments.service';

class CreateAssignmentDto {
  @ApiProperty()
  @IsUUID()
  donationId: string;

  @ApiProperty()
  @IsUUID()
  volunteerId: string;
}

class QrTokenDto {
  @ApiProperty({ description: 'Token decoded from the scanned QR code' })
  @IsString()
  qrToken: string;
}

@ApiTags('assignments')
@ApiBearerAuth()
@Controller('assignments')
export class AssignmentsController {
  constructor(private assignments: AssignmentsService) {}

  @Post()
  @Roles('ngo', 'donor')
  @ApiOperation({ summary: 'Assign a volunteer to a claimed donation' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssignmentDto) {
    return this.assignments.create(user, dto.donationId, dto.volunteerId);
  }

  @Get('mine')
  @Roles('volunteer')
  listMine(@CurrentUser() user: AuthUser) {
    return this.assignments.listMine(user);
  }

  @Get('by-donation/:donationId')
  @ApiOperation({ summary: 'Active assignment for a donation (no QR tokens leaked)' })
  byDonation(@Param('donationId', ParseUUIDPipe) donationId: string) {
    return this.assignments.findByDonation(donationId);
  }

  @Post(':id/accept')
  @Roles('volunteer')
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignments.accept(user, id);
  }

  @Post(':id/verify-pickup')
  @Roles('volunteer')
  @ApiOperation({ summary: 'Volunteer scans donor QR at pickup → donation in_transit' })
  verifyPickup(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QrTokenDto,
  ) {
    return this.assignments.verifyPickup(user, id, dto.qrToken);
  }

  @Post(':id/verify-delivery')
  @Roles('volunteer')
  @ApiOperation({ summary: 'Volunteer scans NGO QR at delivery → donation delivered' })
  verifyDelivery(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QrTokenDto,
  ) {
    return this.assignments.verifyDelivery(user, id, dto.qrToken);
  }

  @Post(':id/confirm-receipt')
  @Roles('ngo')
  @ApiOperation({ summary: 'NGO confirms receipt → donation verified' })
  confirmReceipt(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignments.confirmReceipt(user, id);
  }

  @Get(':id/qr/pickup')
  @Roles('donor')
  @ApiOperation({ summary: 'Pickup QR PNG (donor displays this)' })
  pickupQr(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignments.qrImage(user, id, 'pickup');
  }

  @Get(':id/qr/delivery')
  @Roles('ngo')
  @ApiOperation({ summary: 'Delivery QR PNG (NGO displays this)' })
  deliveryQr(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignments.qrImage(user, id, 'delivery');
  }
}
