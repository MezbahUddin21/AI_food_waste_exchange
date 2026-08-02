import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { get, post } from '../lib/api';
import { Donation, FOOD_LABELS, timeLeft } from '../lib/types';
import StatusBadge from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { CardSkeleton, EmptyState, PageHeader } from '../components/ui';

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/** NGO home: browse listed donations (list + map), claim them. */
export default function NgoDashboard() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () =>
    get<Donation[]>('/donations?status=listed')
      .then(setDonations)
      .catch(() => {})
      .finally(() => setLoading(false));
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

  const filtered = category ? donations.filter((d) => d.food_category === category) : donations;
  const withCoords = filtered.filter((d) => d.location?.coordinates);
  const center: [number, number] = withCoords.length
    ? [withCoords[0].location!.coordinates[1], withCoords[0].location!.coordinates[0]]
    : [23.8103, 90.4125];

  return (
    <div>
      <PageHeader
        title="Available food nearby"
        subtitle="Live listings from verified donors — claim before the window closes"
        action={
          <div className="flex items-center gap-2">
            <select className="input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {Object.entries(FOOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <div className="flex rounded-lg border border-gray-300 p-0.5">
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'list' ? 'bg-brand-600 text-white' : 'text-gray-600'}`}
                onClick={() => setView('list')}
              >
                List
              </button>
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'map' ? 'bg-brand-600 text-white' : 'text-gray-600'}`}
                onClick={() => setView('map')}
              >
                Map
              </button>
            </div>
          </div>
        }
      />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading && <CardSkeleton />}

      {view === 'list' && !loading && (
        <>
          {filtered.length === 0 && (
            <EmptyState
              icon="map"
              title="No open listings right now"
              hint="New donations appear here the moment donors list them — check back soon or watch for notifications."
            />
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((d) => (
              <div key={d.id} className="card-hover flex flex-col">
                {d.photo_urls?.[0] ? (
                  <img src={d.photo_urls[0]} alt="" className="mb-3 h-36 w-full rounded-xl object-cover" />
                ) : (
                  <div className="mb-3 flex h-36 w-full items-center justify-center rounded-xl bg-brand-50 text-brand-300">
                    <Icon name="package" className="h-10 w-10" />
                  </div>
                )}
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-gray-900">{d.title}</h2>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-sm text-gray-600">
                  {FOOD_LABELS[d.food_category]} · {d.quantity_servings} servings
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                  <Icon name="building" className="h-3.5 w-3.5" /> {d.donors?.org_name ?? 'Donor'}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-700">
                  <Icon name="clock" className="h-4 w-4" /> {timeLeft(d.pickup_window_end)}
                </p>
                <button
                  className="btn-primary mt-4 w-full"
                  disabled={busy === d.id}
                  onClick={() => claim(d.id)}
                >
                  {busy === d.id ? 'Claiming…' : 'Claim donation'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'map' && (
        <div className="card overflow-hidden !p-0" style={{ height: 520 }}>
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
                  <button className="mt-1 font-medium text-brand-600 underline" onClick={() => claim(d.id)}>
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
