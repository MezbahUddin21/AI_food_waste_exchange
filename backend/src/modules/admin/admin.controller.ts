import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../lib/supabase.module';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminMessageDto, ReviewProfileChangeDto } from './dto/admin-review.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin', 'government')
@Controller('admin')
export class AdminController {
  constructor(
    @Inject(SUPABASE) private supabase: SupabaseClient,
    private notifications: NotificationsService,
  ) {}

  @Get('users')
  async users(@Query('role') role?: string) {
    let q = this.supabase.from('users').select('*').order('created_at', { ascending: false }).limit(200);
    if (role) q = q.eq('role', role);
    const { data } = await q;
    return data ?? [];
  }

  @Get('dashboard')
  @Roles('admin')
  @ApiOperation({ summary: 'Administrator platform overview' })
  async dashboard() {
    const [
      totalUsers,
      donors,
      ngos,
      volunteers,
      governmentUsers,
      admins,
      totalDonations,
      activeDonations,
      completedDonations,
      openEmergencies,
      pendingDonors,
      pendingNgos,
      pendingVolunteers,
      pendingChanges,
      recentUsers,
    ] = await Promise.all([
      this.supabase.from('users').select('*', { count: 'exact', head: true }),
      this.supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'donor'),
      this.supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'ngo'),
      this.supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'volunteer'),
      this.supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'government'),
      this.supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      this.supabase.from('donations').select('*', { count: 'exact', head: true }),
      this.supabase.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'listed'),
      this.supabase.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'verified'),
      this.supabase.from('emergency_requests').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      this.supabase.from('donors').select('*', { count: 'exact', head: true }).eq('verified', false),
      this.supabase.from('ngos').select('*', { count: 'exact', head: true }).eq('verified', false),
      this.supabase.from('volunteers').select('*', { count: 'exact', head: true }).eq('verified', false),
      this.supabase.from('profile_change_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      this.supabase.from('users').select('id, full_name, email, role, avatar_url, created_at').order('created_at', { ascending: false }).limit(8),
    ]);

    return {
      total_users: totalUsers.count ?? 0,
      role_counts: {
        donors: donors.count ?? 0,
        ngos: ngos.count ?? 0,
        volunteers: volunteers.count ?? 0,
        government: governmentUsers.count ?? 0,
        admins: admins.count ?? 0,
      },
      total_donations: totalDonations.count ?? 0,
      active_donations: activeDonations.count ?? 0,
      completed_donations: completedDonations.count ?? 0,
      open_emergencies: openEmergencies.count ?? 0,
      pending_verifications: (pendingDonors.count ?? 0) + (pendingNgos.count ?? 0) + (pendingVolunteers.count ?? 0) + (pendingChanges.count ?? 0),
      recent_users: recentUsers.data ?? [],
    };
  }

  @Post('verify/:profileType/:id')
  @Roles('admin') // government can view, only admin verifies
  @ApiOperation({ summary: 'Mark a donor, NGO, or volunteer as verified' })
  async verify(
    @Param('profileType') profileType: 'donor' | 'ngo' | 'volunteer',
    @Param('id', ParseUUIDPipe) id: string,
    @Body('verified') verified = true,
  ) {
    const table = profileType === 'donor' ? 'donors' : profileType === 'ngo' ? 'ngos' : profileType === 'volunteer' ? 'volunteers' : null;
    if (!table) throw new BadRequestException('profileType must be donor, ngo, or volunteer');
    const { error } = await this.supabase.from(table).update({ verified }).eq('id', id);
    if (error) throw new BadRequestException(error.message);
    const { data: owner } = await this.supabase.from(table).select('user_id').eq('id', id).maybeSingle();
    if (verified && owner) {
      await this.notifications.notify(owner.user_id, 'profile_verified', 'Profile verified', 'An administrator approved your profile. You can now use verified features and edit your details.');
    }
    return { ok: true };
  }

  @Get('pending-verifications')
  async pending() {
    const { data: donors } = await this.supabase.from('donors').select('*, users!inner(full_name, email)').eq('verified', false);
    const { data: ngos } = await this.supabase.from('ngos').select('*, users!inner(full_name, email)').eq('verified', false);
    const { data: volunteers } = await this.supabase
      .from('volunteers')
      .select('*, users!inner(full_name, email)')
      .eq('verified', false);
    return { donors: donors ?? [], ngos: ngos ?? [], volunteers: volunteers ?? [] };
  }

  @Get('profile-change-requests')
  @Roles('admin')
  @ApiOperation({ summary: 'Pending profile edits with current and requested values' })
  async profileChangeRequests() {
    const { data, error } = await this.supabase
      .from('profile_change_requests')
      .select('*, users!profile_change_requests_user_id_fkey(full_name, email, avatar_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  @Post('profile-change-requests/:id/review')
  @Roles('admin')
  @ApiOperation({ summary: 'Approve or reject a proposed profile edit' })
  async reviewProfileChange(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewProfileChangeDto,
  ) {
    if (!dto.approved && !dto.message?.trim()) {
      throw new BadRequestException('A message is required when rejecting changes');
    }
    const { data, error } = await this.supabase.rpc('review_profile_change_atomic', {
      p_request_id: id,
      p_admin_user_id: admin.id,
      p_approve: dto.approved,
      p_message: dto.message?.trim() || null,
    });
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new BadRequestException('Profile change was not reviewed');
    await this.notifications.notify(
      data.user_id,
      dto.approved ? 'profile_change_approved' : 'profile_change_rejected',
      dto.approved ? 'Profile changes approved' : 'Profile changes need attention',
      dto.message?.trim() || (dto.approved ? 'Your requested profile changes were approved.' : 'Your requested profile changes were rejected.'),
      { profile_change_request_id: id },
    );
    return data;
  }

  @Post('profile-change-requests/:id/message')
  @Roles('admin')
  @ApiOperation({ summary: 'Message a user about a pending profile edit' })
  async messageAboutChange(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminMessageDto) {
    const { data } = await this.supabase
      .from('profile_change_requests')
      .select('user_id')
      .eq('id', id)
      .eq('status', 'pending')
      .maybeSingle();
    if (!data) throw new BadRequestException('Pending profile change not found');
    await this.notifications.notify(data.user_id, 'admin_message', 'Message from an administrator', dto.message.trim(), { profile_change_request_id: id });
    return { ok: true };
  }

  @Post('message/:userId')
  @Roles('admin')
  @ApiOperation({ summary: 'Send an in-app message to a user under review' })
  async messageUser(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: AdminMessageDto) {
    const { data } = await this.supabase.from('users').select('id').eq('id', userId).maybeSingle();
    if (!data) throw new BadRequestException('User not found');
    await this.notifications.notify(userId, 'admin_message', 'Message from an administrator', dto.message.trim());
    return { ok: true };
  }
}
