import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { get, post } from '../lib/api';
import { Assignment, timeLeft } from '../lib/types';
import QrScanner from '../components/QrScanner';
import { Icon } from '../components/Icon';
import { CardSkeleton, EmptyState, PageHeader, StatCard } from '../components/ui';

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/** Volunteer home: task list + route map + scan-to-verify handoffs. */
export default function VolunteerDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scanning, setScanning] = useState<Assignment | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () =>
    get<Assignment[]>('/assignments/mine')
      .then(setAssignments)
      .catch(() => {})
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const accept = async (id: string) => {
    await post(`/assignments/${id}/accept`);
    load();
  };

  const onScan = async (payload: { assignment_id: string; kind: string; token: string }) => {
    if (!scanning) return;
    setError('');
    setMessage('');
    try {
      const endpoint = payload.kind === 'pickup' ? 'verify-pickup' : 'verify-delivery';
      await post(`/assignments/${scanning.id}/${endpoint}`, { qrToken: payload.token });
      setMessage(payload.kind === 'pickup' ? '✅ Pickup verified — safe travels!' : '✅ Delivery verified — thank you!');
      setScanning(null);
      load();
    } catch (e) {
      setError((e as Error).message);
      setScanning(null);
    }
  };

  const active = assignments.filter((a) => !['delivered', 'cancelled'].includes(a.status));
  const done = assignments.filter((a) => ['delivered', 'cancelled'].includes(a.status));
  const delivered = assignments.filter((a) => a.status === 'delivered');

  return (
    <div>
      <PageHeader
        title="My pickup tasks"
        subtitle="Accept a task, scan the donor's QR at pickup and the NGO's QR at delivery"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon="truck" label="Active tasks" value={active.length} accent />
        <StatCard icon="check-circle" label="Deliveries completed" value={delivered.length} />
        <StatCard
          icon="heart"
          label="Meals carried"
          value={delivered.reduce((s, a) => s + (a.donations?.quantity_servings ?? 0), 0)}
        />
      </div>

      {message && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">{message}</p>}
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading && <CardSkeleton count={2} />}

      {!loading && active.length === 0 && (
        <EmptyState
          icon="truck"
          title="No active tasks"
          hint="When an NGO assigns you a pickup, it will appear here and you'll get a notification."
        />
      )}

      <div className="space-y-4">
        {active.map((a) => {
          const d = a.donations;
          const donorPos = d?.location?.coordinates
            ? ([d.location.coordinates[1], d.location.coordinates[0]] as [number, number])
            : null;
          return (
            <div key={a.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{d?.title ?? 'Donation'}</h2>
                  <p className="text-sm text-gray-600">
                    Pickup: {d?.donors?.org_name} — {d?.donors?.address}
                  </p>
                  <p className="text-sm text-gray-600">
                    Deliver to: {d?.ngos?.org_name ?? 'NGO'} — {d?.ngos?.address ?? ''}
                  </p>
                  <p className="mt-1 text-sm font-medium text-amber-700">
                    ⏱ {timeLeft(d?.pickup_window_end ?? null)} · status: {a.status.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {a.status === 'offered' && (
                    <button className="btn-primary" onClick={() => accept(a.id)}>
                      <Icon name="check" className="h-4 w-4" /> Accept task
                    </button>
                  )}
                  {a.status === 'accepted' && (
                    <button className="btn-primary" onClick={() => setScanning(a)}>
                      <Icon name="camera" className="h-4 w-4" /> Scan pickup QR
                    </button>
                  )}
                  {a.status === 'picked_up' && (
                    <button className="btn-primary" onClick={() => setScanning(a)}>
                      <Icon name="camera" className="h-4 w-4" /> Scan delivery QR
                    </button>
                  )}
                </div>
              </div>
              {donorPos && (
                <div className="mt-3 overflow-hidden rounded-lg" style={{ height: 220 }}>
                  <MapContainer center={donorPos} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={donorPos} icon={icon}>
                      <Popup>Pickup: {d?.donors?.org_name}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 font-semibold text-gray-700">Completed</h2>
          <div className="space-y-2">
            {done.map((a) => (
              <div key={a.id} className="card flex items-center justify-between !py-3">
                <span className="text-sm">{a.donations?.title}</span>
                <span className="text-xs text-gray-500">
                  {a.delivery_verified_at ? new Date(a.delivery_verified_at).toLocaleDateString() : a.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {scanning && <QrScanner onResult={onScan} onClose={() => setScanning(null)} />}
    </div>
  );
}
