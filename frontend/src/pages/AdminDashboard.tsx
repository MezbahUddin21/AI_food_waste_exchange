import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import { PageHeader, StatCard } from '../components/ui';
import { Icon } from '../components/Icon';

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

interface DashboardData {
  total_users: number;
  role_counts: { donors: number; ngos: number; volunteers: number; government: number; admins: number };
  total_donations: number;
  active_donations: number;
  completed_donations: number;
  open_emergencies: number;
  pending_verifications: number;
  recent_users: AdminUser[];
}

const roleLabels: Record<string, string> = {
  donor: 'Donors', ngo: 'NGOs', volunteer: 'Volunteers', government: 'Government', admin: 'Administrators',
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    get<DashboardData>('/admin/dashboard').then(setData).catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="flex min-h-64 items-center justify-center text-sm text-gray-400">Loading dashboard…</div>;

  const roleRows = Object.entries({
    donor: data.role_counts.donors,
    ngo: data.role_counts.ngos,
    volunteer: data.role_counts.volunteers,
    government: data.role_counts.government,
    admin: data.role_counts.admins,
  });

  return (
    <div>
      <PageHeader title="Administrator dashboard" subtitle="A live view of users, food recovery, and reviews" action={<Link to="/app/admin" className="btn-primary"><Icon name="shield" className="h-4 w-4" /> Review profiles</Link>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="users" label="Registered users" value={data.total_users} accent />
        <StatCard icon="package" label="Total donations" value={data.total_donations} sub={`${data.active_donations} currently listed`} />
        <StatCard icon="check" label="Completed donations" value={data.completed_donations} sub="Verified deliveries" />
        <StatCard icon="clock" label="Pending reviews" value={data.pending_verifications} sub={`${data.open_emergencies} open emergencies`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between"><h2 className="section-title">User breakdown</h2><Icon name="users" className="h-5 w-5 text-gray-300" /></div>
          <div className="space-y-3">
            {roleRows.map(([role, count]) => (
              <div key={role}>
                <div className="mb-1 flex justify-between text-sm"><span className="text-gray-600">{roleLabels[role]}</span><span className="font-semibold text-gray-900">{count}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${data.total_users ? Math.max((count / data.total_users) * 100, count ? 3 : 0) : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between"><h2 className="section-title">Recent users</h2><Link to="/app/admin" className="text-xs font-semibold text-brand-600 hover:underline">Manage reviews</Link></div>
          <div className="divide-y divide-gray-100">
            {data.recent_users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 py-3">
                {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">{user.full_name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase()}</span>}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-900">{user.full_name}</p><p className="truncate text-xs text-gray-500">{user.email}</p></div>
                <span className="badge bg-gray-100 text-gray-600">{roleLabels[user.role] ?? user.role}</span>
              </div>
            ))}
            {!data.recent_users.length && <p className="py-4 text-sm text-gray-500">No users yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
