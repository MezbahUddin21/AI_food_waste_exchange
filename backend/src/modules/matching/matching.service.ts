import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../lib/supabase.module';
import { MlClient } from '../../lib/ml.client';
import { DonationsService } from '../donations/donations.service';

@Injectable()
export class MatchingService {
  constructor(
    @Inject(SUPABASE) private supabase: SupabaseClient,
    private ml: MlClient,
    private donations: DonationsService,
  ) {}

  /**
   * PostGIS narrows candidates (indexed spatial query), the ML service ranks them
   * by distance + capacity + food-type match + reliability.
   */
  async recommendNgos(donationId: string, maxKm = 25) {
    const donation = await this.donations.getById(donationId);
    const { lat, lng } = this.pointToLatLng(donation.location);

    const { data: candidates, error } = await this.supabase.rpc('nearby_ngos', {
      lat,
      lng,
      max_km: maxKm,
      wanted_category: null, // fetch all nearby; category match feeds the score instead of filtering
    });
    if (error) throw new BadRequestException(error.message);
    if (!candidates?.length) return [];

    const ranked = await this.ml.rankNgos(
      {
        food_category: donation.food_category,
        quantity_servings: donation.quantity_servings,
      },
      candidates.map((c: any) => ({
        ngo_id: c.ngo_id,
        distance_km: c.distance_km,
        capacity_meals_per_day: c.capacity_meals_per_day,
        accepts_category: (c.accepted_food_types ?? []).includes(donation.food_category),
        reliability_score: Number(c.reliability_score),
      })),
    );

    // Re-attach display fields
    const byId = new Map(candidates.map((c: any) => [c.ngo_id, c]));
    return ranked.map((r) => ({ ...(byId.get(r.ngo_id) as object), ...r }));
  }

  async recommendVolunteers(donationId: string) {
    const donation = await this.donations.getById(donationId);
    const { lat, lng } = this.pointToLatLng(donation.location);
    const { data, error } = await this.supabase.rpc('nearby_volunteers', { lat, lng });
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  /** Supabase returns geography as GeoJSON or WKB hex depending on select; handle GeoJSON. */
  private pointToLatLng(location: any): { lat: number; lng: number } {
    if (location?.coordinates) {
      return { lng: location.coordinates[0], lat: location.coordinates[1] };
    }
    throw new BadRequestException('Donation has no usable location');
  }
}
