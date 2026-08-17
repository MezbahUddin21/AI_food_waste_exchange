import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/ui';

interface PendingProfile {
  id: string;
  user_id: string;
  org_name?: string;
  address?: string;
  vehicle_type?: string;
  users?: { full_name: string; email: string };
}

interface ProfileChangeRequest {
  id: string;
  user_id: string;
  role: 'donor' | 'ngo' | 'volunteer';
  current_values: Record<string, unknown>;
  requested_values: Record<string, unknown>;
  created_at: string;
  users?: { full_name: string; email: string; avatar_url?: string | null };
}

type VerificationType = 'donor' | 'ngo' | 'volunteer';

const fieldLabels: Record<string, string> = {
  org_name: 'Organization name',
  org_type: 'Organization type',
  address: 'Address',
  location: 'Map location',
  capacity_meals_per_day: 'Capacity (meals/day)',
  accepted_food_types: 'Accepted food types',
  vehicle_type: 'Vehicle',
  max_carry_kg: 'Maximum carry (kg)',
  service_radius_km: 'Service radius (km)',
};

const displayValue = (key: string, value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'location' && typeof value === 'string') {
    const point = value.match(/^POINT\(([-\d.]+) ([-\d.]+)\)$/);
    return point ? `${point[2]}, ${point[1]}` : 'Map coordinates';
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

export default function AdminPage() {
  const [donors, setDonors] = useState<PendingProfile[]>([]);
  const [ngos, setNgos] = useState<PendingProfile[]>([]);
  const [volunteers, setVolunteers] = useState<PendingProfile[]>([]);
  const [changes, setChanges] = useState<ProfileChangeRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const [pending, requests] = await Promise.all([
        get<{ donors: PendingProfile[]; ngos: PendingProfile[]; volunteers: PendingProfile[] }>('/admin/pending-verifications'),
        get<ProfileChangeRequest[]>('/admin/profile-change-requests'),
      ]);
      setDonors(pending.donors);
      setNgos(pending.ngos);
      setVolunteers(pending.volunteers);
      setChanges(requests);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => { void load(); }, []);

  const verify = async (type: VerificationType, id: string) => {
    setBusy(`${type}:${id}`);
    try {
      await post(`/admin/verify/${type}/${id}`, { verified: true });
      await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(''); }
  };

  const messageUser = async (userId: string, key: string) => {
    const message = notes[key]?.trim();
    if (!message) { setError('Write a message before sending it.'); return; }
    setBusy(key);
    try { await post(`/admin/message/${userId}`, { message }); setNotes((all) => ({ ...all, [key]: '' })); }
    catch (err) { setError((err as Error).message); } finally { setBusy(''); }
  };

  const review = async (request: ProfileChangeRequest, approved: boolean) => {
    const message = notes[request.id]?.trim() ?? '';
    if (!approved && !message) { setError('A message is required when rejecting changes.'); return; }
    setBusy(request.id);
    try {
      await post(`/admin/profile-change-requests/${request.id}/review`, { approved, message: message || undefined });
      await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(''); }
  };

  const messageChange = async (request: ProfileChangeRequest) => {
    const message = notes[request.id]?.trim();
    if (!message) { setError('Write a message before sending it.'); return; }
    setBusy(request.id);
    try { await post(`/admin/profile-change-requests/${request.id}/message`, { message }); setNotes((all) => ({ ...all, [request.id]: '' })); }
    catch (err) { setError((err as Error).message); } finally { setBusy(''); }
  };

  const Section = ({ title, rows, type }: { title: string; rows: PendingProfile[]; type: VerificationType }) => (
    <div className="card">
      <h2 className="section-title mb-3">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-gray-500">Nothing pending 🎉</p>}
      <div className="space-y-3">
        {rows.map((profile) => {
          const key = `${type}:${profile.id}`;
          return <div key={profile.id} className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-medium">{profile.org_name ?? profile.users?.full_name}</p><p className="text-xs text-gray-500">{profile.address ?? `${profile.vehicle_type ?? 'No vehicle'} · ${profile.users?.email ?? ''}`}</p></div>
              <button className="btn-primary !py-1.5 text-xs" disabled={busy === key} onClick={() => void verify(type, profile.id)}><Icon name="check" className="h-3.5 w-3.5" /> Verify</button>
            </div>
            <textarea className="input mt-3 min-h-16 text-xs" placeholder="Optional message to this applicant…" value={notes[key] ?? ''} onChange={(event) => setNotes((all) => ({ ...all, [key]: event.target.value }))} />
            <button className="btn-outline mt-2 !px-3 !py-1.5 text-xs" disabled={busy === key} onClick={() => void messageUser(profile.user_id, key)}>Send message</button>
          </div>;
        })}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Profile reviews" subtitle="Compare requested changes with the currently trusted details before approving" />
      {error && <div className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {changes.length > 0 && <div className="mb-6 space-y-4">
        <h2 className="section-title">Requested profile changes</h2>
        {changes.map((request) => {
          const user = request.users;
          return <div key={request.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold text-gray-900">{user?.full_name ?? 'User'} <span className="badge ml-1 bg-gray-100 text-gray-600">{request.role}</span></p><p className="text-xs text-gray-500">{user?.email} · submitted {new Date(request.created_at).toLocaleString()}</p></div>
              <span className="badge bg-blue-50 text-blue-700"><Icon name="clock" className="h-3 w-3" /> Pending review</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <div className="grid grid-cols-[1fr_1fr_1fr] bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500"><span>Field</span><span>Current</span><span>Requested</span></div>
              {Object.entries(request.requested_values).map(([key, value]) => <div key={key} className="grid grid-cols-[1fr_1fr_1fr] border-t border-gray-100 px-3 py-2 text-sm"><span className="font-medium text-gray-700">{fieldLabels[key] ?? key}</span><span className="break-words text-gray-500">{displayValue(key, request.current_values[key])}</span><span className="break-words font-medium text-gray-900">{displayValue(key, value)}</span></div>)}
            </div>
            <textarea className="input mt-4 min-h-20" placeholder="Message to the user (required when rejecting)…" value={notes[request.id] ?? ''} onChange={(event) => setNotes((all) => ({ ...all, [request.id]: event.target.value }))} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={busy === request.id} onClick={() => void review(request, true)}><Icon name="check" className="h-4 w-4" /> Approve changes</button>
              <button className="btn-danger" disabled={busy === request.id} onClick={() => void review(request, false)}>Reject with message</button>
              <button className="btn-outline" disabled={busy === request.id} onClick={() => void messageChange(request)}>Message only</button>
            </div>
          </div>;
        })}
      </div>}

      <h2 className="section-title mb-4">New profile verifications</h2>
      <div className="grid gap-6 lg:grid-cols-3"><Section title="Donors" rows={donors} type="donor" /><Section title="NGOs" rows={ngos} type="ngo" /><Section title="Volunteers" rows={volunteers} type="volunteer" /></div>
    </div>
  );
}
