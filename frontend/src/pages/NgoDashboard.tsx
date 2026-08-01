import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { get, post } from '../lib/api';
import { Donation, FOOD_LABELS, timeLeft } from '../lib/types';
import StatusBadge from '../components/StatusBadge';

// Fix default marker icons under bundlers
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/** NGO home: browse listed donations (list + map), claim them. */
export default function NgoDashboard() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = () => get<Donation[]>('/donations?status=listed').then(setDonations).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const claim = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      await post(`/donations/${id}/claim`);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const withCoords = donations.filter((d) => d.location?.coordinates);
  const center: [number, number] = withCoords.length
    ? [withCoords[0].location!.coordinates[1], withCoords[0].location!.coordinates[0]]
    : [23.8103, 90.4125]; // Dhaka default

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Available food nearby</h1>
        <div className="flex gap-1">
          <button className={view === 'list' ? 'btn-primary' : 'btn-outline'} onClick={() => setView('list')}>
            List
          </button>
          <button className={view === 'map' ? 'btn-primary' : 'btn-outline'} onClick={() => setView('map')}>
            Map
          </button>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {view === 'list' && (
        <div className="grid gap-4 md:grid-cols-2">
          {donations.length === 0 && (
            <div className="card col-span-2 text-center text-gray-500">No open listings right now.</div>
          )}
          {donations.map((d) => (
            <div key={d.id} className="card">
              {d.photo_urls?.[0] && (
                <img src={d.photo_urls[0]} alt="" className="mb-3 h-36 w-full rounded-lg object-cover" />
              )}
              <div className="mb-1 flex items-start justify-between">
                <h2 className="font-semibold">{d.title}</h2>
                <StatusBadge status={d.status} />
              </div>
              <p className="text-sm text-gray-600">
                {FOOD_LABELS[d.food_category]} · {d.quantity_servings} servings · from{' '}
                {d.donors?.org_name ?? 'donor'}
              </p>
              <p className="mt-1 text-sm font-medium text-amber-700">⏱ {timeLeft(d.pickup_window_end)}</p>
              <button
                className="btn-primary mt-3 w-full"
                disabled={busy === d.id}
                onClick={() => claim(d.id)}
              >
                {busy === d.id ? 'Claiming…' : 'Claim donation'}
              </button>
            </div>
          ))}
        </div>
      )}

      {view === 'map' && (
        <div className="card overflow-hidden !p-0" style={{ height: 480 }}>
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {withCoords.map((d) => (
              <Marker
                key={d.id}
                position={[d.location!.coordinates[1], d.location!.coordinates[0]]}
                icon={icon}
              >
                <Popup>
                  <strong>{d.title}</strong>
                  <br />
                  {d.quantity_servings} servings · {timeLeft(d.pickup_window_end)}
                  <br />
                  <button className="mt-1 text-brand-600 underline" onClick={() => claim(d.id)}>
                    Claim
                  </button>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
