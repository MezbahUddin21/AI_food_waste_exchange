import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/ui';
import { Icon } from '../components/Icon';

const ROLE_LABEL: Record<string, string> = {
  donor: 'Food Donor',
  ngo: 'NGO / Shelter',
  volunteer: 'Volunteer',
  government: 'Government Agency',
  admin: 'Administrator',
};

/** Profile & settings: account info + role profile details (read-mostly for v1). */
export default function ProfilePage() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  if (!profile) return null;

  const p = (profile.profile ?? {}) as Record<string, unknown>;
  const rows: [string, unknown][] = [
    ['Organization', p.org_name],
    ['Address', p.address],
    ['Capacity (meals/day)', p.capacity_meals_per_day],
    ['Vehicle', p.vehicle_type],
    ['Max carry (kg)', p.max_carry_kg],
    ['Service radius (km)', p.service_radius_km],
    ['Verified', p.verified === undefined ? undefined : p.verified ? 'Yes ✅' : 'Pending review ⏳'],
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile & settings" subtitle="Your account and organization details" />

      <div className="card mb-5 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 font-display text-xl font-bold text-brand-700">
          {profile.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-gray-900">{profile.full_name}</p>
          <p className="truncate text-sm text-gray-500">{profile.email}</p>
          <span className="badge mt-1.5 bg-brand-50 text-brand-700">
            <Icon name="shield" className="h-3 w-3" /> {ROLE_LABEL[profile.role]}
          </span>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Details</h2>
        <dl className="divide-y divide-gray-100">
          {rows
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-right font-medium text-gray-900">{String(v)}</dd>
              </div>
            ))}
          <div className="flex justify-between gap-4 py-2.5 text-sm">
            <dt className="text-gray-500">Account ID</dt>
            <dd>
              <button
                className="font-mono text-xs text-gray-400 hover:text-gray-600"
                onClick={() => {
                  navigator.clipboard.writeText(profile.id);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? 'Copied!' : `${profile.id.slice(0, 8)}… (copy)`}
              </button>
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        Need to change organization details? Contact support — edits require re-verification.
      </p>
    </div>
  );
}
