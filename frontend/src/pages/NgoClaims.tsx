import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { Donation, FOOD_LABELS, RankedNgo, timeLeft } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import QrModal from '../components/QrModal';
import { Icon } from '../components/Icon';
import { EmptyState, PageHeader } from '../components/ui';

interface Volunteer {
  volunteer_id: string;
  vehicle_type: string;
  max_carry_kg: number;
  distance_km: number;
}

/** NGO claims view: assign volunteers, show delivery QR, confirm receipt. */
export default function NgoClaims() {
  const [claims, setClaims] = useState<Donation[]>([]);
  const [assigning, setAssigning] = useState<Donation | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setClaims(await get<Donation[]>('/donations/claims'));
  };
  useEffect(() => {
    load();
  }, []);

  const openAssign = async (d: Donation) => {
    setAssigning(d);
    setVolunteers(await get<Volunteer[]>(`/donations/${d.id}/recommended-volunteers`));
  };

  const assign = async (volunteerId: string) => {
    if (!assigning) return;
    setError('');
    try {
      await post('/assignments', { donationId: assigning.id, volunteerId });
      setAssigning(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const confirmReceipt = async (donationId: string) => {
    const assignment = await get<{ id: string }>(`/assignments/by-donation/${donationId}`);
    await post(`/assignments/${assignment.id}/confirm-receipt`);
    load();
  };

  return (
    <div>
      <PageHeader
        title="My claims"
        subtitle="Assign volunteers, show your delivery QR, and confirm receipt"
      />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {claims.length === 0 && (
        <EmptyState
          icon="heart"
          title="No active claims"
          hint="Browse available food and claim a donation — it will show up here for volunteer assignment."
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {claims.map((d) => (
          <div key={d.id} className="card">
            <div className="mb-1 flex items-start justify-between">
              <h2 className="font-semibold">{d.title}</h2>
              <StatusBadge status={d.status} />
            </div>
            <p className="text-sm text-gray-600">
              {FOOD_LABELS[d.food_category]} · {d.quantity_servings} servings ·{' '}
              {timeLeft(d.pickup_window_end)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.status === 'claimed' && (
                <button className="btn-primary !py-1.5 text-xs" onClick={() => openAssign(d)}>
                  <Icon name="truck" className="h-3.5 w-3.5" /> Assign volunteer
                </button>
              )}
              {(d.status === 'in_transit' || d.status === 'assigned') && (
                <button className="btn-primary !py-1.5 text-xs" onClick={() => setQrFor(d.id)}>
                  <Icon name="qr" className="h-3.5 w-3.5" /> Delivery QR
                </button>
              )}
              {d.status === 'delivered' && (
                <button className="btn-primary !py-1.5 text-xs" onClick={() => confirmReceipt(d.id)}>
                  <Icon name="check" className="h-3.5 w-3.5" /> Confirm receipt
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAssigning(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 font-semibold">Assign a volunteer — {assigning.title}</h2>
            {volunteers.length === 0 && <p className="text-sm text-gray-500">No available volunteers cover this area.</p>}
            <div className="space-y-2">
              {volunteers.map((v) => (
                <button
                  key={v.volunteer_id}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-left hover:bg-brand-50"
                  onClick={() => assign(v.volunteer_id)}
                >
                  <span className="text-sm">
                    🚴 {v.vehicle_type} · carries {v.max_carry_kg} kg
                  </span>
                  <span className="text-xs text-gray-500">{v.distance_km.toFixed(1)} km away</span>
                </button>
              ))}
            </div>
            <button className="btn-outline mt-4 w-full" onClick={() => setAssigning(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {qrFor && <QrModal donationId={qrFor} kind="delivery" onClose={() => setQrFor(null)} />}
    </div>
  );
}
