import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../lib/supabase.module';
import { MlClient } from '../../lib/ml.client';
import { withGeoJsonLocation } from '../../lib/geo';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../auth/auth.types';
import { CreateDonationDto, ListDonationsQueryDto } from './dto/donations.dto';
import { actorAllowed, canTransition, DonationStatus } from './donation-lifecycle';

@Injectable()
export class DonationsService {
  constructor(
    @Inject(SUPABASE) private supabase: SupabaseClient,
    private ml: MlClient,
    private notifications: NotificationsService,
  ) {}

  /** Donor creates a listing; ML fills the safe pickup window before insert. */
  async create(user: AuthUser, dto: CreateDonationDto) {
    const donor = await this.getDonorByUser(user.id);

    const spoilage = await this.ml.predictSpoilage({
      food_category: dto.foodCategory,
      prepared_at: dto.preparedAt,
      storage: dto.storage,
      packaging: dto.packaging,
      ambient_temp_c: dto.ambientTempC,
    });

    if (new Date(spoilage.pickup_window_end) <= new Date()) {
      throw new BadRequestException(
        'This food is estimated to already be past its safe pickup window',
      );
    }

    const { data, error } = await this.supabase
      .from('donations')
      .insert({
        donor_id: donor.id,
        title: dto.title,
        description: dto.description ?? null,
        food_category: dto.foodCategory,
        quantity_servings: dto.quantityServings,
        quantity_kg: dto.quantityKg ?? null,
        photo_urls: dto.photoUrls ?? [],
        prepared_at: dto.preparedAt,
        storage: dto.storage,
        packaging: dto.packaging,
        pickup_window_start: spoilage.pickup_window_start,
        pickup_window_end: spoilage.pickup_window_end,
        spoilage_confidence: spoilage.confidence,
        location: donor.location, // copy donor's point
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    await this.recordEvent(data.id, null, 'listed', user.id);
    return data;
  }

  async list(query: ListDonationsQueryDto) {
    await this.expirePastListings();
    // near=lat,lng,km uses the PostGIS RPC, then hydrates full rows.
    if (query.near) {
      const [lat, lng, km] = query.near.split(',').map(Number);
      if ([lat, lng, km].some(Number.isNaN)) {
        throw new BadRequestException('near must be "lat,lng,km"');
      }
      const { data: nearby, error } = await this.supabase.rpc('nearby_donations', {
        lat,
        lng,
        max_km: km,
      });
      if (error) throw new BadRequestException(error.message);
      const ids = (nearby ?? []).map((r: any) => r.donation_id);
      if (!ids.length) return [];
      const { data } = await this.supabase
        .from('donations')
        .select('*, donors(org_name, org_type, address)')
        .in('id', ids);
      const distById = new Map((nearby as any[]).map((r) => [r.donation_id, r.distance_km]));
      return (data ?? [])
        .map((d) => ({ ...withGeoJsonLocation(d), distance_km: distById.get(d.id) }))
        .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
    }

    let q = this.supabase
      .from('donations')
      .select('*, donors(org_name, org_type, address)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (query.status) q = q.eq('status', query.status);
    if (query.status === 'listed') q = q.gt('pickup_window_end', new Date().toISOString());
    if (query.category) q = q.eq('food_category', query.category);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map(withGeoJsonLocation);
  }

  async getById(id: string) {
    const { data } = await this.supabase
      .from('donations')
      .select('*, donors(org_name, org_type, address), ngos:claimed_by_ngo(org_name, address)')
      .eq('id', id)
      .maybeSingle();
    if (!data) throw new NotFoundException('Donation not found');
    return withGeoJsonLocation(data);
  }

  /** Donor's own listings. */
  async listMine(user: AuthUser) {
    const donor = await this.getDonorByUser(user.id);
    const { data } = await this.supabase
      .from('donations')
      .select('*')
      .eq('donor_id', donor.id)
      .order('created_at', { ascending: false });
    return (data ?? []).map(withGeoJsonLocation);
  }

  /** NGO's own claimed donations, restricted at the query boundary. */
  async listClaims(user: AuthUser) {
    const ngo = await this.getNgoByUser(user.id);
    const { data, error } = await this.supabase
      .from('donations')
      .select('*, donors(org_name, org_type, address)')
      .eq('claimed_by_ngo', ngo.id)
      .in('status', ['claimed', 'assigned', 'in_transit', 'delivered'])
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map(withGeoJsonLocation);
  }

  /** NGO claims a listed donation. */
  async claim(user: AuthUser, donationId: string) {
    await this.expirePastListings();
    const ngo = await this.getNgoByUser(user.id);
    const donation = await this.getById(donationId);

    if (donation.pickup_window_end && new Date(donation.pickup_window_end) <= new Date()) {
      throw new BadRequestException('This donation is past its safe pickup window');
    }

    await this.transition(user, donation, 'claimed', { claimed_by_ngo: ngo.id });

    // Notify the donor
    const donorUser = await this.donorUserId(donation.donor_id);
    if (donorUser) {
      await this.notifications.notify(
        donorUser,
        'donation_claimed',
        'Donation claimed',
        `"${donation.title}" was claimed by ${ngo.org_name}`,
        { donation_id: donationId },
      );
    }
    return this.getById(donationId);
  }

  async cancel(user: AuthUser, donationId: string, note?: string) {
    const donation = await this.getById(donationId);

    // Only the owning donor or claiming NGO may cancel
    if (user.role === 'donor') {
      const donor = await this.getDonorByUser(user.id);
      if (donor.id !== donation.donor_id) throw new ForbiddenException('Not your donation');
    } else if (user.role === 'ngo') {
      const ngo = await this.getNgoByUser(user.id);
      if (ngo.id !== donation.claimed_by_ngo) throw new ForbiddenException('Not your claim');
    }

    await this.transition(user, donation, 'cancelled', {}, note);
    return this.getById(donationId);
  }

  /** Shared, state-machine-enforced status transition with audit trail. */
  async transition(
    user: AuthUser,
    donation: { id: string; status: DonationStatus },
    to: DonationStatus,
    extraFields: Record<string, unknown> = {},
    note?: string,
  ) {
    if (!canTransition(donation.status, to)) {
      throw new BadRequestException(`Cannot go from '${donation.status}' to '${to}'`);
    }
    if (!actorAllowed(user, to)) {
      throw new ForbiddenException(`Role '${user.role}' cannot set status '${to}'`);
    }
    // Optimistic concurrency: status must still be what we read (two NGOs racing to claim).
    const { data, error } = await this.supabase
      .from('donations')
      .update({ status: to, ...extraFields })
      .eq('id', donation.id)
      .eq('status', donation.status)
      .select('id');
    if (error) throw new BadRequestException(error.message);
    if (!data?.length) {
      throw new BadRequestException('Donation was modified concurrently — refresh and retry');
    }
    await this.recordEvent(donation.id, donation.status, to, user.id, note);
  }

  /** Ensure an assignment is created only by a party that owns the donation. */
  async assertAssignmentActor(user: AuthUser, donation: { donor_id: string; claimed_by_ngo?: string | null }) {
    if (user.role === 'ngo') {
      const ngo = await this.getNgoByUser(user.id);
      if (donation.claimed_by_ngo !== ngo.id) throw new ForbiddenException('Not your claim');
      return;
    }
    if (user.role === 'donor') {
      const donor = await this.getDonorByUser(user.id);
      if (donation.donor_id !== donor.id) throw new ForbiddenException('Not your donation');
      return;
    }
    throw new ForbiddenException('Only the donor or claiming NGO can assign a volunteer');
  }

  async statusHistory(donationId: string) {
    const { data } = await this.supabase
      .from('status_events')
      .select('*')
      .eq('donation_id', donationId)
      .order('created_at', { ascending: true });
    return data ?? [];
  }

  /**
   * Expire listed donations on demand. This is intentionally idempotent and
   * concurrency-safe, so every browse/claim request repairs stale listings
   * even when no background worker is running.
   */
  private async expirePastListings() {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('donations')
      .select('id')
      .eq('status', 'listed')
      .not('pickup_window_end', 'is', null)
      .lte('pickup_window_end', now)
      .limit(500);
    if (error) throw new BadRequestException(error.message);

    for (const donation of data ?? []) {
      const { data: updated, error: updateError } = await this.supabase
        .from('donations')
        .update({ status: 'expired' })
        .eq('id', donation.id)
        .eq('status', 'listed')
        .select('id');
      if (updateError) throw new BadRequestException(updateError.message);
      if (updated?.length) {
        await this.recordEvent(donation.id, 'listed', 'expired', null, 'Pickup window elapsed');
      }
    }
  }

  // ---- helpers ----

  async getDonorByUser(userId: string) {
    const { data } = await this.supabase.from('donors').select('*').eq('user_id', userId).maybeSingle();
    if (!data) throw new ForbiddenException('No donor profile');
    return data;
  }

  async getNgoByUser(userId: string) {
    const { data } = await this.supabase.from('ngos').select('*').eq('user_id', userId).maybeSingle();
    if (!data) throw new ForbiddenException('No NGO profile');
    return data;
  }

  private async donorUserId(donorId: string): Promise<string | null> {
    const { data } = await this.supabase.from('donors').select('user_id').eq('id', donorId).maybeSingle();
    return data?.user_id ?? null;
  }

  private async recordEvent(
    donationId: string,
    from: DonationStatus | null,
    to: DonationStatus,
    actorUserId: string | null,
    note?: string,
  ) {
    await this.supabase.from('status_events').insert({
      donation_id: donationId,
      from_status: from,
      to_status: to,
      actor_user_id: actorUserId,
      note: note ?? null,
    });
  }
}
