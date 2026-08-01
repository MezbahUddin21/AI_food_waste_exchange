import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import { Donation, FOOD_LABELS, timeLeft } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import QrModal from '../components/QrModal';

/** Donor home: their listings + status + pickup QR when a volunteer is en route. */
export default function DonorDashboard() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [qrFor, setQrFor] = useState<string | null>(null); // assignment id
  const [loading, setLoading] = useState(true);

  const load = () =>
    get<Donation[]>('/donations/mine')
      .then(setDonations)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const showPickupQr = async (donationId: string) => {
    // find assignment via history endpoint? Simpler: the API exposes QR by assignment,
    // so we fetch the donation detail which includes assignment info in Phase 5.
    // For now query assignments through donation history:
    const events = await get<{ to_status: string }[]>(`/donations/${donationId}/history`);
    void events;
    setQrFor(donationId);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">My donations</h1>
        <Link to="/donations/new" className="btn-primary">
          + List surplus food
        </Link>
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}
      {!loading && donations.length === 0 && (
        <div className="card text-center text-gray-500">
          No listings yet. List your surplus food and nearby NGOs will be notified.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {donations.map((d) => (
          <div key={d.id} className="card">
            <div className="mb-2 flex items-start justify-between">
              <h2 className="font-semibold">{d.title}</h2>
              <StatusBadge status={d.status} />
            </div>
            <p className="text-sm text-gray-600">
              {FOOD_LABELS[d.food_category]} · {d.quantity_servings} servings
              {d.quantity_kg ? ` · ${d.quantity_kg} kg` : ''}
            </p>
            <p className="mt-1 text-sm">
              <span className="font-medium text-amber-700">⏱ {timeLeft(d.pickup_window_end)}</span>
              {d.spoilage_confidence != null && (
                <span className="ml-2 text-xs text-gray-400">
                  (AI confidence {(Number(d.spoilage_confidence) * 100).toFixed(0)}%)
                </span>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <Link to={`/donations/${d.id}`} className="btn-outline text-xs">
                Details
              </Link>
              {(d.status === 'assigned' || d.status === 'in_transit') && (
                <button className="btn-primary text-xs" onClick={() => showPickupQr(d.id)}>
                  Show pickup QR
                </button>
              )}
              {(d.status === 'listed' || d.status === 'claimed') && (
                <button
                  className="btn-outline text-xs text-red-600"
                  onClick={async () => {
                    await post(`/donations/${d.id}/cancel`);
                    load();
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {qrFor && <QrModal donationId={qrFor} kind="pickup" onClose={() => setQrFor(null)} />}
    </div>
  );
}
