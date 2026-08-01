export interface Donation {
  id: string;
  title: string;
  description: string | null;
  food_category: string;
  quantity_servings: number;
  quantity_kg: number | null;
  photo_urls: string[];
  prepared_at: string;
  storage: string;
  packaging: string;
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  spoilage_confidence: number | null;
  location: { coordinates: [number, number] } | null; // [lng, lat]
  status: string;
  claimed_by_ngo: string | null;
  created_at: string;
  distance_km?: number;
  donors?: { org_name: string; org_type: string; address: string };
  ngos?: { org_name: string; address: string };
}

export interface Assignment {
  id: string;
  donation_id: string;
  status: 'offered' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
  pickup_verified_at: string | null;
  delivery_verified_at: string | null;
  created_at: string;
  donations?: Donation;
}

export interface RankedNgo {
  ngo_id: string;
  org_name: string;
  address: string;
  distance_km: number;
  capacity_meals_per_day: number;
  reliability_score: number;
  score: number;
  accepts_category: boolean;
}

export const FOOD_LABELS: Record<string, string> = {
  cooked_meal: 'Cooked meal',
  bakery: 'Bakery',
  produce: 'Produce',
  dairy: 'Dairy',
  packaged: 'Packaged',
  other: 'Other',
};

export function timeLeft(end: string | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}
