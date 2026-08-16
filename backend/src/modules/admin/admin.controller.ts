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
