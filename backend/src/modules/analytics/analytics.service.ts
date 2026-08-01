import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../lib/supabase.module';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(SUPABASE) private supabase: SupabaseClient) {}

  /** Platform-wide headline numbers. */
  async summary() {
    const { data: verified } = await this.supabase
      .from('donations')
      .select('quantity_servings, quantity_kg, food_category')
      .eq('status', 'verified');

    const rows = verified ?? [];
    const mealsSaved = rows.reduce((s, d) => s + (d.quantity_servings ?? 0), 0);
    const kgDiverted = rows.reduce((s, d) => s + Number(d.quantity_kg ?? 0), 0);

    const byCategory: Record<string, number> = {};
    for (const d of rows) {
      byCategory[d.food_category] = (byCategory[d.food_category] ?? 0) + d.quantity_servings;
    }

    const { count: totalListings } = await this.supabase
      .from('donations')
      .select('*', { count: 'exact', head: true });
    const { count: activeListings } = await this.supabase
      .from('donations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'listed');
    const { count: expired } = await this.supabase
      .from('donations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'expired');

    return {
      meals_saved: mealsSaved,
      kg_diverted: Math.round(kgDiverted * 10) / 10,
      // Rough EPA-style factor: ~2.5 kg CO2e avoided per kg of food waste diverted.
      co2e_avoided_kg: Math.round(kgDiverted * 2.5 * 10) / 10,
      total_listings: totalListings ?? 0,
      active_listings: activeListings ?? 0,
      expired_listings: expired ?? 0,
      completion_rate:
        totalListings ? Math.round(((rows.length) / totalListings) * 100) : 0,
      servings_by_category: byCategory,
    };
  }

  /** Daily counts for the last N days, for trend charts. */
  async trends(days = 30) {
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { data } = await this.supabase
      .from('donations')
      .select('created_at, status, quantity_servings')
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    const byDay: Record<string, { listed: number; verified_servings: number }> = {};
    for (const d of data ?? []) {
      const day = d.created_at.slice(0, 10);
      byDay[day] ??= { listed: 0, verified_servings: 0 };
      byDay[day].listed += 1;
      if (d.status === 'verified') byDay[day].verified_servings += d.quantity_servings;
    }
    return Object.entries(byDay).map(([date, v]) => ({ date, ...v }));
  }

  async leaderboard() {
    const { data } = await this.supabase
      .from('donations')
      .select('quantity_servings, donor_id, donors(org_name), claimed_by_ngo, ngos:claimed_by_ngo(org_name)')
      .eq('status', 'verified');

    const donorTotals: Record<string, { name: string; servings: number }> = {};
    const ngoTotals: Record<string, { name: string; servings: number }> = {};
    for (const d of data ?? []) {
      const dn = (d.donors as any)?.org_name ?? 'Unknown';
      donorTotals[d.donor_id] ??= { name: dn, servings: 0 };
      donorTotals[d.donor_id].servings += d.quantity_servings;
      if (d.claimed_by_ngo) {
        const nn = (d.ngos as any)?.org_name ?? 'Unknown';
        ngoTotals[d.claimed_by_ngo] ??= { name: nn, servings: 0 };
        ngoTotals[d.claimed_by_ngo].servings += d.quantity_servings;
      }
    }
    const top = (m: Record<string, { name: string; servings: number }>) =>
      Object.values(m).sort((a, b) => b.servings - a.servings).slice(0, 10);
    return { top_donors: top(donorTotals), top_ngos: top(ngoTotals) };
  }
}
