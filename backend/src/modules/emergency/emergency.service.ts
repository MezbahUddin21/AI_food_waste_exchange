import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../lib/supabase.module';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../auth/auth.types';

@Injectable()
export class EmergencyService {
  constructor(
    @Inject(SUPABASE) private supabase: SupabaseClient,
    private notifications: NotificationsService,
  ) {}

  /** NGO broadcasts an urgent need; all donors within radius get notified. */
  async create(user: AuthUser, dto: {
    foodCategory: string;
    quantityServings: number;
    neededBy: string;
    radiusKm?: number;
    note?: string;
  }) {
    const { data: ngo } = await this.supabase
      .from('ngos')
      .select('id, org_name, location')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!ngo) throw new ForbiddenException('No NGO profile');

    const radius = dto.radiusKm ?? 15;
    const { data: request, error } = await this.supabase
      .from('emergency_requests')
      .insert({
        ngo_id: ngo.id,
        food_category: dto.foodCategory,
        quantity_servings: dto.quantityServings,
        needed_by: dto.neededBy,
        radius_km: radius,
        note: dto.note ?? null,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    // Broadcast to donors within radius (raw spatial query via RPC on donors)
    const coords = (ngo.location as any)?.coordinates;
    if (coords) {
      const { data: donors } = await this.supabase
        .from('donors')
        .select('user_id, location');
      // Filter in app for simplicity at this scale; donors table is small.
      // (A dedicated RPC like nearby_ngos would be the next optimization.)
      const nearby = (donors ?? []).filter((d) => {
        const c = (d.location as any)?.coordinates;
        if (!c) return false;
        return this.haversineKm(coords[1], coords[0], c[1], c[0]) <= radius;
      });
      await this.notifications.notifyMany(
        nearby.map((d) => d.user_id),
        'emergency_broadcast',
        'Urgent food need nearby',
        `${ngo.org_name} urgently needs ${dto.quantityServings} servings of ${dto.foodCategory.replace('_', ' ')}`,
        { emergency_request_id: request.id },
      );
    }
    return request;
  }

  async list(status?: string) {
    let q = this.supabase
      .from('emergency_requests')
      .select('*, ngos(org_name, address)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return data ?? [];
  }

  async updateStatus(user: AuthUser, id: string, status: 'partially_filled' | 'fulfilled' | 'expired') {
    const { data: request } = await this.supabase
      .from('emergency_requests')
      .select('*, ngos(user_id)')
      .eq('id', id)
      .maybeSingle();
    if (!request) throw new BadRequestException('Request not found');
    if (user.role !== 'admin' && (request.ngos as any)?.user_id !== user.id) {
      throw new ForbiddenException('Only the requesting NGO can update this');
    }
    const { error } = await this.supabase.from('emergency_requests').update({ status }).eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
}
