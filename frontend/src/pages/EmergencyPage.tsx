import { FormEvent, useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { FOOD_LABELS } from '../lib/types';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/ui';

interface EmergencyRequest {
  id: string;
  food_category: string;
  quantity_servings: number;
  needed_by: string;
  status: string;
  note: string | null;
  ngos?: { org_name: string; address: string };
}

/** NGO: broadcast urgent needs; also lists open requests platform-wide. */
export default function EmergencyPage() {
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [category, setCategory] = useState('cooked_meal');
  const [servings, setServings] = useState(50);
  const [neededBy, setNeededBy] = useState('');
  const [radius, setRadius] = useState(15);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => get<EmergencyRequest[]>('/emergency-requests').then(setRequests).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await post('/emergency-requests', {
        foodCategory: category,
        quantityServings: servings,
        neededBy: new Date(neededBy).toISOString(),
        radiusKm: radius,
        note: note || undefined,
      });
      setNote('');
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Emergency requests"
        subtitle="Broadcast urgent needs to every donor within your chosen radius"
      />
      <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="section-title mb-4 flex items-center gap-2">
          <Icon name="alert" className="h-5 w-5 text-red-500" /> Broadcast urgent need
        </h2>
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">Food type</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(FOOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Servings needed</label>
              <input className="input" type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} required />
            </div>
            <div>
              <label className="label">Radius (km)</label>
              <input className="input" type="number" min={1} max={100} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="label">Needed by</label>
            <input className="input" type="datetime-local" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} required />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Broadcasting…' : 'Broadcast to nearby donors'}
          </button>
        </form>
      </div>

      <div>
        <h2 className="section-title mb-4">Open requests</h2>
        <div className="space-y-3">
          {requests.length === 0 && <div className="card text-center text-gray-500">None right now.</div>}
          {requests.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {r.quantity_servings} servings · {FOOD_LABELS[r.food_category]}
                </span>
                <span className={`badge ${r.status === 'open' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                  {r.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {r.ngos?.org_name} · needed by {new Date(r.needed_by).toLocaleString()}
              </p>
              {r.note && <p className="mt-1 text-sm text-gray-500">{r.note}</p>}
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
