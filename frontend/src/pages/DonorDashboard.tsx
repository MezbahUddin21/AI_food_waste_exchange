import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import { Donation, FOOD_LABELS, timeLeft } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import QrModal from '../components/QrModal';
import { Icon } from '../components/Icon';
import { CardSkeleton, EmptyState, PageHeader, StatCard } from '../components/ui';

/** Donor home: impact stats, listings, pickup QR access. */
export default function DonorDashboard() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    get<Donation[]>('/donations/mine')
      .then(setDonations)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const verified = donations.filter((d) => d.status === 'verified');
  const active = donations.filter((d) =>
    ['listed', 'claimed', 'assigned', 'in_transit', 'delivered'].includes(d.status),
  );
  const mealsSaved = verified.reduce((s, d) => s + d.quantity_servings, 0);

  return (
    <div>
      <PageHeader
        title="My donations"
        subtitle="List surplus food and track it to a verified delivery"
        action={
          <Link to="/app/donations/new" className="btn-primary">
            <Icon name="plus" className="h-4 w-4" /> List surplus food
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="heart" label="Meals saved" value={mealsSaved} accent />
        <StatCard icon="package" label="Total listings" value={donations.length} />
        <StatCard icon="truck" label="Active now" value={active.length} />
        <StatCard icon="check-circle" label="Completed" value={verified.length} />
      </div>

      {loading && <CardSkeleton />}

      {!loading && donations.length === 0 && (
        <EmptyState
          icon="package"
          title="No listings yet"
          hint="List your surplus food and nearby NGOs will be notified instantly. The AI will estimate a safe pickup window for you."
          action={
            <Link to="/app/donations/new" className="btn-primary">
              <Icon name="plus" className="h-4 w-4" /> Create your first listing
            </Link>
          }
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {donations.map((d) => (
          <div key={d.id} className="card-hover">
            {d.photo_urls?.[0] && (
              <img src={d.photo_urls[0]} alt="" className="mb-3 h-36 w-full rounded-xl object-cover" />
            )}
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="font-semibold text-gray-900">{d.title}</h2>
              <StatusBadge status={d.status} />
            </div>
            <p className="text-sm text-gray-600">
              {FOOD_LABELS[d.food_category]} · {d.quantity_servings} servings
              {d.quantity_kg ? ` · ${d.quantity_kg} kg` : ''}
            </p>
            {!['verified', 'expired', 'cancelled'].includes(d.status) && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm">
                <Icon name="clock" className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-700">{timeLeft(d.pickup_window_end)}</span>
                {d.spoilage_confidence != null && (
                  <span className="text-xs text-gray-400">
                    · AI {(Number(d.spoilage_confidence) * 100).toFixed(0)}% confident
                  </span>
                )}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/app/donations/${d.id}`} className="btn-outline !py-1.5 text-xs">
                Details
              </Link>
              {(d.status === 'assigned' || d.status === 'in_transit') && (
                <button className="btn-primary !py-1.5 text-xs" onClick={() => setQrFor(d.id)}>
                  <Icon name="qr" className="h-3.5 w-3.5" /> Pickup QR
                </button>
              )}
              {(d.status === 'listed' || d.status === 'claimed') && (
                <button
                  className="btn-danger !py-1.5 text-xs"
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
