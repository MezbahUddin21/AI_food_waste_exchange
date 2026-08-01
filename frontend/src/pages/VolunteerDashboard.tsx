import { useEffect, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { get, post } from '../lib/api';
import { Assignment, timeLeft } from '../lib/types';
import QrScanner from '../components/QrScanner';

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

  const load = () => get<Assignment[]>('/assignments/mine').then(setAssignments).catch(() => {});
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

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">My pickup tasks</h1>
      {message && <p className="mb-3 rounded-lg bg-green-100 p-3 text-sm text-green-800">{message}</p>}
      {error && <p className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</p>}

      {active.length === 0 && <div className="card mb-4 text-center text-gray-500">No active tasks.</div>}

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
                      Accept task
                    </button>
                  )}
                  {a.status === 'accepted' && (
                    <button className="btn-primary" onClick={() => setScanning(a)}>
                      📷 Scan pickup QR
                    </button>
                  )}
                  {a.status === 'picked_up' && (
                    <button className="btn-primary" onClick={() => setScanning(a)}>
                      📷 Scan delivery QR
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
