import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/ui';

interface PendingOrg {
  id: string;
  org_name: string;
  address: string;
  created_at: string;
}

/** Admin: verify pending donors/NGOs. */
export default function AdminPage() {
  const [donors, setDonors] = useState<PendingOrg[]>([]);
  const [ngos, setNgos] = useState<PendingOrg[]>([]);

  const load = () =>
    get<{ donors: PendingOrg[]; ngos: PendingOrg[] }>('/admin/pending-verifications').then((d) => {
      setDonors(d.donors);
      setNgos(d.ngos);
    });
  useEffect(() => {
    load();
  }, []);

  const verify = async (type: 'donor' | 'ngo', id: string) => {
    await post(`/admin/verify/${type}/${id}`, { verified: true });
    load();
  };

  const Section = ({ title, rows, type }: { title: string; rows: PendingOrg[]; type: 'donor' | 'ngo' }) => (
    <div className="card">
      <h2 className="section-title mb-3">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-gray-500">Nothing pending 🎉</p>}
      <div className="space-y-2">
        {rows.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
            <div>
              <p className="text-sm font-medium">{o.org_name}</p>
              <p className="text-xs text-gray-500">{o.address}</p>
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
        subtitle="Review and approve new donors and NGOs before they enter the matching pool"
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Donors" rows={donors} type="donor" />
        <Section title="NGOs" rows={ngos} type="ngo" />
      </div>
    </div>
  );
}
