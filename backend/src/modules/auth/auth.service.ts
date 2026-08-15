import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../lib/supabase.module';
import type { AuthUser } from './auth.types';
import { RegisterProfileDto } from './dto/register-profile.dto';

const toPoint = (loc: { lat: number; lng: number }) => `POINT(${loc.lng} ${loc.lat})`;

@Injectable()
export class AuthService {
  constructor(@Inject(SUPABASE) private supabase: SupabaseClient) {}

  /**
   * Called once after Supabase signup: creates the users row plus the
   * role-specific profile (donors / ngos / volunteers). Government users
   * get only the users row; verification is a manual admin step.
   */
  async registerProfile(user: AuthUser, dto: RegisterProfileDto) {
    const { data: existing } = await this.supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (existing) throw new ConflictException('Profile already registered');

    if (dto.role === 'donor' || dto.role === 'ngo') {
      if (!dto.orgName || !dto.address || !dto.location) {
        throw new BadRequestException('orgName, address and location are required for this role');
      }
    }

    const { error: userErr } = await this.supabase.from('users').insert({
      id: user.id,
      email: user.email,
      full_name: dto.fullName,
      phone: dto.phone ?? null,
      role: dto.role,
    });
    if (userErr) throw new BadRequestException(userErr.message);

    if (dto.role === 'donor') {
      const { error } = await this.supabase.from('donors').insert({
        user_id: user.id,
        org_name: dto.orgName,
        org_type: dto.orgType ?? 'other',
        address: dto.address,
        location: toPoint(dto.location!),
      });
      if (error) return this.rollbackRegistration(user.id, error.message);
    } else if (dto.role === 'ngo') {
      const { error } = await this.supabase.from('ngos').insert({
        user_id: user.id,
        org_name: dto.orgName,
        address: dto.address,
        location: toPoint(dto.location!),
        capacity_meals_per_day: dto.capacityMealsPerDay ?? 100,
        ...(dto.acceptedFoodTypes ? { accepted_food_types: dto.acceptedFoodTypes } : {}),
      });
      if (error) return this.rollbackRegistration(user.id, error.message);
    } else if (dto.role === 'volunteer') {
      const { error } = await this.supabase.from('volunteers').insert({
        user_id: user.id,
        vehicle_type: dto.vehicleType ?? 'none',
        max_carry_kg: dto.maxCarryKg ?? 10,
        service_radius_km: dto.serviceRadiusKm ?? 10,
        ...(dto.location ? { location: toPoint(dto.location) } : {}),
      });
      if (error) return this.rollbackRegistration(user.id, error.message);
    }

    return this.getMe(user.id);
  }

  private async rollbackRegistration(userId: string, message: string): Promise<never> {
    const { error } = await this.supabase.from('users').delete().eq('id', userId);
    if (error) {
      throw new BadRequestException(`${message}; profile rollback also failed: ${error.message}`);
    }
    throw new BadRequestException(message);
  }

  async getMe(userId: string) {
    const { data: profile } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!profile) throw new NotFoundException('Profile not registered yet');

    const table =
      profile.role === 'donor' ? 'donors'
      : profile.role === 'ngo' ? 'ngos'
      : profile.role === 'volunteer' ? 'volunteers'
      : null;

    let roleProfile = null;
    if (table) {
      const { data } = await this.supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      roleProfile = data;
    }
    return { ...profile, profile: roleProfile };
  }
}
