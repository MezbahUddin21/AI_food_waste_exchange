import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface SpoilageInput {
  food_category: string;
  prepared_at: string; // ISO
  storage: string;
  packaging: string;
  ambient_temp_c?: number;
}

export interface SpoilageResult {
  pickup_window_start: string;
  pickup_window_end: string;
  confidence: number;
  shelf_hours: number;
}

export interface NgoCandidate {
  ngo_id: string;
  distance_km: number;
  capacity_meals_per_day: number;
  accepts_category: boolean;
  reliability_score: number;
}

/**
 * Thin client for the Python ML microservice.
 * Every call has a local fallback so the platform still works if the
 * ML service is cold-starting on Render or down entirely.
 */
@Injectable()
export class MlClient {
  private readonly log = new Logger(MlClient.name);
  private readonly base: string;

  constructor(config: ConfigService) {
    this.base = config.get('ML_SERVICE_URL') ?? 'http://localhost:8000';
  }

  async predictSpoilage(input: SpoilageInput): Promise<SpoilageResult> {
    try {
      const { data } = await axios.post(`${this.base}/predict/spoilage`, input, { timeout: 8000 });
      return data;
    } catch (e) {
      this.log.warn(`ML spoilage call failed, using fallback: ${(e as Error).message}`);
      return this.fallbackSpoilage(input);
    }
  }

  async rankNgos(donation: { food_category: string; quantity_servings: number }, candidates: NgoCandidate[]) {
    try {
      const { data } = await axios.post(
        `${this.base}/rank/ngos`,
        { donation, candidates },
        { timeout: 8000 },
      );
      return data.ranked as (NgoCandidate & { score: number })[];
    } catch (e) {
      this.log.warn(`ML rank call failed, using distance fallback: ${(e as Error).message}`);
      return candidates
        .map((c) => ({ ...c, score: Math.max(0, 1 - c.distance_km / 25) }))
        .sort((a, b) => b.score - a.score);
    }
  }

  /** Mirror of the ML service's rule table so the backend never blocks on it. */
  private fallbackSpoilage(input: SpoilageInput): SpoilageResult {
    const baseHours: Record<string, number> = {
      cooked_meal: 4,
      bakery: 24,
      produce: 48,
      dairy: 24,
      packaged: 24 * 30,
      other: 12,
    };
    const storageMult: Record<string, number> = {
      hot_held: 0.75,
      room_temp: 1,
      refrigerated: 3,
      frozen: 12,
    };
    const packagingMult: Record<string, number> = { sealed: 1.25, covered: 1, open: 0.75 };

    const shelfHours =
      (baseHours[input.food_category] ?? 12) *
      (storageMult[input.storage] ?? 1) *
      (packagingMult[input.packaging] ?? 1);

    const prepared = new Date(input.prepared_at).getTime();
    const end = prepared + shelfHours * 3600_000;
    return {
      pickup_window_start: new Date().toISOString(),
      pickup_window_end: new Date(end).toISOString(),
      confidence: 0.5, // fallback is less confident than the service
      shelf_hours: shelfHours,
    };
  }
}
