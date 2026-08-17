import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../lib/supabase.module';
import type { AuthUser } from './auth.types';
import { RegisterProfileDto } from './dto/register-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
    const { data: changeRequest } = await this.supabase
      .from('profile_change_requests')
      .select('id, status, requested_values, admin_message, created_at, reviewed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { ...profile, profile: roleProfile, change_request: changeRequest ?? null };
  }

  /**
   * A profile must be approved before it can be changed. Trust-sensitive role
   * changes are sent back to the admin queue for another review.
   */
  async updateMe(user: AuthUser, dto: UpdateProfileDto) {
    const current = await this.getMe(user.id);
    const role = current.role as AuthUser['role'];
    const supplied = Object.entries(dto).filter(([, value]) => value !== undefined);
    if (!supplied.length) throw new BadRequestException('Provide at least one field to update');

    const allowedByRole: Record<string, string[]> = {
      donor: ['fullName', 'phone', 'avatarUrl', 'orgName', 'orgType', 'address', 'location'],
      ngo: ['fullName', 'phone', 'avatarUrl', 'orgName', 'address', 'location', 'capacityMealsPerDay', 'acceptedFoodTypes'],
      volunteer: ['fullName', 'phone', 'avatarUrl', 'vehicleType', 'maxCarryKg', 'serviceRadiusKm', 'location', 'available'],
      government: ['fullName', 'phone', 'avatarUrl'],
      admin: ['fullName', 'phone', 'avatarUrl'],
    };
    const allowed = allowedByRole[role ?? ''] ?? [];
    const unsupported = supplied.map(([key]) => key).filter((key) => !allowed.includes(key));
    if (unsupported.length) {
      throw new BadRequestException(`These fields cannot be changed for your role: ${unsupported.join(', ')}`);
    }

    if (role === 'donor' || role === 'ngo' || role === 'volunteer') {
      if (!current.profile?.verified) {
        throw new ForbiddenException('Your profile must be verified by an administrator before you can edit it');
      }
    }

    const userUpdates: Record<string, string | null> = {};
    if (dto.fullName !== undefined) userUpdates.full_name = dto.fullName.trim();
    if (dto.phone !== undefined) userUpdates.phone = dto.phone.trim() || null;
    if (dto.avatarUrl !== undefined) userUpdates.avatar_url = dto.avatarUrl.trim() || null;

    const roleUpdates: Record<string, unknown> = {};
    if (dto.orgName !== undefined) roleUpdates.org_name = dto.orgName.trim();
    if (dto.orgType !== undefined) roleUpdates.org_type = dto.orgType;
    if (dto.address !== undefined) roleUpdates.address = dto.address.trim();
    if (dto.location !== undefined) roleUpdates.location = toPoint(dto.location);
    if (dto.capacityMealsPerDay !== undefined) roleUpdates.capacity_meals_per_day = dto.capacityMealsPerDay;
    if (dto.acceptedFoodTypes !== undefined) roleUpdates.accepted_food_types = dto.acceptedFoodTypes;
    if (dto.vehicleType !== undefined) roleUpdates.vehicle_type = dto.vehicleType;
    if (dto.maxCarryKg !== undefined) roleUpdates.max_carry_kg = dto.maxCarryKg;
    if (dto.serviceRadiusKm !== undefined) roleUpdates.service_radius_km = dto.serviceRadiusKm;
    if (dto.available !== undefined) roleUpdates.available = dto.available;

    const needsReverification = Object.keys(roleUpdates).some((key) => key !== 'available');
    const { error } = await this.supabase.rpc('update_profile_atomic', {
      p_user_id: user.id,
      p_user_updates: userUpdates,
      p_role_updates: roleUpdates,
      p_requires_reverification: needsReverification,
    });
    if (error) throw new BadRequestException(error.message);
    return this.getMe(user.id);
  }
}
