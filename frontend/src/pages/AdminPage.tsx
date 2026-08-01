import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';

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
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-gray-500">Nothing pending.</p>}
      <div className="space-y-2">
        {rows.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
            <div>
              <p className="text-sm font-medium">{o.org_name}</p>
              <p className="text-xs text-gray-500">{o.address}</p>
            </div>
            <button className="btn-primary text-xs" onClick={() => verify(type, o.id)}>
              ✓ Verify
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Admin — pending verifications</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Donors" rows={donors} type="donor" />
        <Section title="NGOs" rows={ngos} type="ngo" />
      </div>
    </div>
  );
}
