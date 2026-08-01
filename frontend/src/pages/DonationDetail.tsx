import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get } from '../lib/api';
import { Donation, FOOD_LABELS, RankedNgo, timeLeft } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../auth/AuthContext';

interface StatusEvent {
  id: number;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
}

/** Donation detail: full info, AI-ranked NGO recommendations (donor view), timeline. */
export default function DonationDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [donation, setDonation] = useState<Donation | null>(null);
  const [history, setHistory] = useState<StatusEvent[]>([]);
  const [ngos, setNgos] = useState<RankedNgo[]>([]);

  useEffect(() => {
    if (!id) return;
    get<Donation>(`/donations/${id}`).then(setDonation).catch(() => {});
    get<StatusEvent[]>(`/donations/${id}/history`).then(setHistory).catch(() => {});
    if (profile?.role === 'donor' || profile?.role === 'admin') {
      get<RankedNgo[]>(`/donations/${id}/recommended-ngos`).then(setNgos).catch(() => {});
    }
  }, [id, profile?.role]);

  if (!donation) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2">
        <div className="card">
          {donation.photo_urls?.[0] && (
            <img src={donation.photo_urls[0]} alt="" className="mb-4 h-56 w-full rounded-lg object-cover" />
          )}
          <div className="mb-2 flex items-start justify-between">
            <h1 className="text-xl font-bold">{donation.title}</h1>
            <StatusBadge status={donation.status} />
          </div>
          {donation.description && <p className="mb-3 text-gray-600">{donation.description}</p>}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Category</dt>
            <dd>{FOOD_LABELS[donation.food_category]}</dd>
            <dt className="text-gray-500">Quantity</dt>
            <dd>
              {donation.quantity_servings} servings{donation.quantity_kg ? ` / ${donation.quantity_kg} kg` : ''}
            </dd>
            <dt className="text-gray-500">Donor</dt>
            <dd>{donation.donors?.org_name} — {donation.donors?.address}</dd>
            <dt className="text-gray-500">Prepared</dt>
            <dd>{new Date(donation.prepared_at).toLocaleString()}</dd>
            <dt className="text-gray-500">Safe pickup window</dt>
            <dd className="font-medium text-amber-700">
              {timeLeft(donation.pickup_window_end)}
              {donation.spoilage_confidence != null &&
                ` (AI ${(Number(donation.spoilage_confidence) * 100).toFixed(0)}% confident)`}
            </dd>
          </dl>
        </div>

        {ngos.length > 0 && (
          <div className="card mt-6">
            <h2 className="mb-3 font-semibold">🤖 AI-recommended NGOs</h2>
            <div className="space-y-2">
              {ngos.map((n, i) => (
                <div key={n.ngo_id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {i + 1}. {n.org_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {n.distance_km.toFixed(1)} km · capacity {n.capacity_meals_per_day}/day ·
                      reliability {(Number(n.reliability_score) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <span className="badge bg-brand-100 text-brand-700">score {(n.score * 100).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card h-fit">
        <h2 className="mb-3 font-semibold">Timeline</h2>
        <ol className="space-y-3">
          {history.map((e) => (
            <li key={e.id} className="border-l-2 border-brand-500 pl-3">
              <p className="text-sm font-medium">{e.to_status.replace('_', ' ')}</p>
              <p className="text-xs text-gray-500">{new Date(e.created_at).toLocaleString()}</p>
              {e.note && <p className="text-xs text-gray-400">{e.note}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
