import { useEffect, useState } from 'react';
import { get } from '../lib/api';
import { PageHeader, StatCard } from '../components/ui';

interface Summary {
  meals_saved: number;
  kg_diverted: number;
  co2e_avoided_kg: number;
  total_listings: number;
  active_listings: number;
  expired_listings: number;
  completion_rate: number;
  servings_by_category: Record<string, number>;
}

interface TrendPoint {
  date: string;
  listed: number;
  verified_servings: number;
}

interface Leaderboard {
  top_donors: { name: string; servings: number }[];
  top_ngos: { name: string; servings: number }[];
}

/** Analytics for admin/government (also the default gov landing page). */
export default function AnalyticsDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [board, setBoard] = useState<Leaderboard | null>(null);

  useEffect(() => {
    get<Summary>('/analytics/summary').then(setSummary).catch(() => {});
    get<TrendPoint[]>('/analytics/trends').then(setTrends).catch(() => {});
    get<Leaderboard>('/analytics/leaderboard').then(setBoard).catch(() => {});
  }, []);

  const maxListed = Math.max(1, ...trends.map((t) => t.listed));

  return (
    <div>
      <PageHeader
        title="Impact analytics"
        subtitle="Live platform metrics — meals saved, waste diverted, and community leaders"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon="heart" label="Meals saved" value={summary?.meals_saved ?? '—'} accent />
        <StatCard icon="package" label="Food diverted" value={summary ? `${summary.kg_diverted} kg` : '—'} />
        <StatCard icon="leaf" label="CO₂e avoided" value={summary ? `${summary.co2e_avoided_kg} kg` : '—'} />
        <StatCard icon="check-circle" label="Completion rate" value={summary ? `${summary.completion_rate}%` : '—'} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="section-title mb-3">Listings — last 30 days</h2>
          {trends.length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
          <div className="flex h-40 items-end gap-1">
            {trends.map((t) => (
              <div key={t.date} className="group relative flex-1">
                <div
                  className="rounded-t bg-brand-500 transition-colors group-hover:bg-brand-700"
                  style={{ height: `${(t.listed / maxListed) * 140}px` }}
                  title={`${t.date}: ${t.listed} listed, ${t.verified_servings} servings verified`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title mb-3">Servings by category</h2>
          {summary && Object.keys(summary.servings_by_category).length === 0 && (
            <p className="text-sm text-gray-500">No verified donations yet.</p>
          )}
          <div className="space-y-2">
            {summary &&
              Object.entries(summary.servings_by_category).map(([cat, servings]) => {
                const max = Math.max(...Object.values(summary.servings_by_category));
                return (
                  <div key={cat}>
                    <div className="mb-0.5 flex justify-between text-sm">
                      <span>{cat.replace('_', ' ')}</span>
                      <span className="text-gray-500">{servings}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(servings / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title mb-3">🏆 Top donors</h2>
          <Ranking rows={board?.top_donors ?? []} />
        </div>
        <div className="card">
          <h2 className="section-title mb-3">🏆 Top NGOs</h2>
          <Ranking rows={board?.top_ngos ?? []} />
        </div>
      </div>
    </div>
  );
}

function Ranking({ rows }: { rows: { name: string; servings: number }[] }) {
  if (!rows.length) return <p className="text-sm text-gray-500">No data yet.</p>;
  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.name + i} className="flex justify-between text-sm">
          <span>
            {i + 1}. {r.name}
          </span>
          <span className="font-medium">{r.servings} servings</span>
        </li>
      ))}
    </ol>
  );
}
