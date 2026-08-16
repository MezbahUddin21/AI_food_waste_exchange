import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/ui';

interface PendingOrg {
  id: string;
  org_name?: string;
  address?: string;
  vehicle_type?: string;
  users?: { full_name: string; email: string };
  created_at: string;
}

type VerificationType = 'donor' | 'ngo' | 'volunteer';

/** Admin: verify pending donors, NGOs, and volunteers. */
export default function AdminPage() {
  const [donors, setDonors] = useState<PendingOrg[]>([]);
  const [ngos, setNgos] = useState<PendingOrg[]>([]);
  const [volunteers, setVolunteers] = useState<PendingOrg[]>([]);

  const load = () =>
    get<{ donors: PendingOrg[]; ngos: PendingOrg[]; volunteers: PendingOrg[] }>('/admin/pending-verifications').then((d) => {
      setDonors(d.donors);
      setNgos(d.ngos);
      setVolunteers(d.volunteers);
    });
  useEffect(() => {
    load();
  }, []);

  const verify = async (type: VerificationType, id: string) => {
    await post(`/admin/verify/${type}/${id}`, { verified: true });
    load();
  };

  const Section = ({ title, rows, type }: { title: string; rows: PendingOrg[]; type: VerificationType }) => (
    <div className="card">
      <h2 className="section-title mb-3">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-gray-500">Nothing pending 🎉</p>}
      <div className="space-y-2">
        {rows.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
            <div>
              <p className="text-sm font-medium">{o.org_name ?? o.users?.full_name}</p>
              <p className="text-xs text-gray-500">{o.address ?? `${o.vehicle_type ?? 'No vehicle'} · ${o.users?.email ?? ''}`}</p>
            </div>
            <button className="btn-primary !py-1.5 text-xs" onClick={() => verify(type, o.id)}>
              <Icon name="check" className="h-3.5 w-3.5" /> Verify
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Verifications"
        subtitle="Review new and changed profiles before enabling trusted account features"
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Donors" rows={donors} type="donor" />
        <Section title="NGOs" rows={ngos} type="ngo" />
        <Section title="Volunteers" rows={volunteers} type="volunteer" />
      </div>
    </div>
  );
}
