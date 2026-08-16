import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../lib/supabase.module';
import { Roles } from '../auth/decorators';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin', 'government')
@Controller('admin')
export class AdminController {
  constructor(@Inject(SUPABASE) private supabase: SupabaseClient) {}

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
      pending_verifications: (pendingDonors.count ?? 0) + (pendingNgos.count ?? 0) + (pendingVolunteers.count ?? 0),
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
    return { ok: true };
  }

  @Get('pending-verifications')
  async pending() {
    const { data: donors } = await this.supabase.from('donors').select('*').eq('verified', false);
    const { data: ngos } = await this.supabase.from('ngos').select('*').eq('verified', false);
    const { data: volunteers } = await this.supabase
      .from('volunteers')
      .select('*, users!inner(full_name, email)')
      .eq('verified', false);
    return { donors: donors ?? [], ngos: ngos ?? [], volunteers: volunteers ?? [] };
  }
}
