import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useAuth, type Profile } from '../auth/AuthContext';
import { PageHeader } from '../components/ui';
import { Icon } from '../components/Icon';
import { patch } from '../lib/api';
import { geocode } from '../lib/geocode';
import { supabase } from '../lib/supabase';

const ROLE_LABEL: Record<string, string> = {
  donor: 'Food Donor',
  ngo: 'NGO / Shelter',
  volunteer: 'Volunteer',
  government: 'Government Agency',
  admin: 'Administrator',
};

const FOOD_TYPES = [
  ['cooked_meal', 'Cooked meals'],
  ['bakery', 'Bakery'],
  ['produce', 'Produce'],
  ['dairy', 'Dairy'],
  ['packaged', 'Packaged'],
  ['other', 'Other'],
] as const;

const sameList = (a: string[], b: string[]) =>
  [...a].sort().join('|') === [...b].sort().join('|');

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  if (!profile) return null;
  return <ProfileForm key={profile.id} profile={profile} refreshProfile={refreshProfile} />;
}

function ProfileForm({ profile, refreshProfile }: { profile: Profile; refreshProfile: () => Promise<void> }) {
  const details = (profile.profile ?? {}) as Record<string, unknown>;
  const roleNeedsApproval = ['donor', 'ngo', 'volunteer'].includes(profile.role);
  const verified = !roleNeedsApproval || details.verified === true;
  const originalFoods = (details.accepted_food_types as string[] | undefined) ?? [];

  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [orgName, setOrgName] = useState(String(details.org_name ?? ''));
  const [orgType, setOrgType] = useState(String(details.org_type ?? 'other'));
  const [address, setAddress] = useState(String(details.address ?? ''));
  const [serviceArea, setServiceArea] = useState('');
  const [capacity, setCapacity] = useState(Number(details.capacity_meals_per_day ?? 100));
  const [acceptedFoods, setAcceptedFoods] = useState<string[]>(originalFoods);
  const [vehicle, setVehicle] = useState(String(details.vehicle_type ?? 'none'));
  const [maxCarryKg, setMaxCarryKg] = useState(Number(details.max_carry_kg ?? 10));
  const [radius, setRadius] = useState(Number(details.service_radius_km ?? 10));
  const [available, setAvailable] = useState(Boolean(details.available ?? true));
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview('');
      return;
    }
    const preview = URL.createObjectURL(avatarFile);
    setAvatarPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [avatarFile]);

  const chooseAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setError('');
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Avatar must be a JPG, PNG, or WebP image');
      event.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar must be 2 MB or smaller');
      event.target.value = '';
      return;
    }
    setAvatarFile(file);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body: Record<string, unknown> = {};
      if (fullName.trim() !== profile.full_name) body.fullName = fullName.trim();
      if (phone.trim() !== (profile.phone ?? '')) body.phone = phone.trim();

      if (profile.role === 'donor' || profile.role === 'ngo') {
        if (orgName.trim() !== details.org_name) body.orgName = orgName.trim();
        if (address.trim() !== details.address) {
          const location = await geocode(address.trim());
          if (!location) throw new Error('Address not found — try a simpler address');
          body.address = address.trim();
          body.location = { lat: location.lat, lng: location.lng };
        }
      }
      if (profile.role === 'donor' && orgType !== details.org_type) body.orgType = orgType;
      if (profile.role === 'ngo') {
        if (capacity !== Number(details.capacity_meals_per_day)) body.capacityMealsPerDay = capacity;
        if (!sameList(acceptedFoods, originalFoods)) body.acceptedFoodTypes = acceptedFoods;
      }
      if (profile.role === 'volunteer') {
        if (vehicle !== details.vehicle_type) body.vehicleType = vehicle;
        if (maxCarryKg !== Number(details.max_carry_kg)) body.maxCarryKg = maxCarryKg;
        if (radius !== Number(details.service_radius_km)) body.serviceRadiusKm = radius;
        if (available !== Boolean(details.available)) body.available = available;
        if (serviceArea.trim()) {
          const location = await geocode(serviceArea.trim());
          if (!location) throw new Error('Service area not found — try a simpler location');
          body.location = { lat: location.lat, lng: location.lng };
        }
      }

      if (avatarFile) {
        const avatarPath = `${profile.id}/avatar`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(avatarPath, avatarFile, {
            upsert: true,
            contentType: avatarFile.type,
            cacheControl: '3600',
          });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
        body.avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      }

      if (!Object.keys(body).length) throw new Error('No profile changes to save');
      const roleDetailsChanged = Object.keys(body).some((key) =>
        !['fullName', 'phone', 'avatarUrl', 'available'].includes(key),
      );
      await patch('/me', body);
      await refreshProfile();
      setAvatarFile(null);
      setMessage(roleDetailsChanged
        ? 'Changes saved. Your profile is pending administrator re-verification.'
        : 'Profile settings saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile & settings" subtitle="Manage your account and role details" />

      <div className="card mb-5 flex items-center gap-4">
        {avatarPreview || profile.avatar_url ? (
          <img src={avatarPreview || profile.avatar_url || ''} alt="" className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 font-display text-xl font-bold text-brand-700">
            {profile.full_name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-gray-900">{profile.full_name}</p>
          <p className="truncate text-sm text-gray-500">{profile.email}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <span className="badge bg-brand-50 text-brand-700">
              <Icon name="shield" className="h-3 w-3" /> {ROLE_LABEL[profile.role]}
            </span>
            {roleNeedsApproval && (
              <span className={`badge ${verified ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                <Icon name={verified ? 'check' : 'clock'} className="h-3 w-3" />
                {verified ? 'Verified' : 'Pending verification'}
              </span>
            )}
          </div>
        </div>
      </div>

      {!verified && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          An administrator must verify your profile before editing is enabled. If you recently changed role details,
          they are saved and waiting for re-verification.
        </div>
      )}

      <form className="space-y-5" onSubmit={submit}>
        <fieldset disabled={!verified || busy} className="space-y-5 disabled:opacity-60">
          <div className="card">
            <h2 className="section-title mb-4">Account details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Full name</label>
                <input className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Profile photo</label>
                <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-gray-300 p-4 transition-colors hover:border-brand-400 hover:bg-brand-50/40">
                  {avatarPreview || profile.avatar_url ? (
                    <img src={avatarPreview || profile.avatar_url || ''} alt="Avatar preview" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                      <Icon name="user" className="h-6 w-6" />
                    </span>
                  )}
                  <span>
                    <span className="block text-sm font-semibold text-gray-700">Choose an image</span>
                    <span className="block text-xs text-gray-400">JPG, PNG, or WebP · maximum 2 MB</span>
                    {avatarFile && <span className="mt-1 block text-xs font-medium text-brand-600">{avatarFile.name}</span>}
                  </span>
                  <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} />
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Email</label>
                <input className="input bg-gray-50" value={profile.email} disabled />
                <p className="mt-1 text-xs text-gray-400">Email is protected by your Supabase login and confirmation flow.</p>
              </div>
            </div>
          </div>

          {(profile.role === 'donor' || profile.role === 'ngo') && (
            <div className="card">
              <h2 className="section-title mb-1">Organization details</h2>
              <p className="mb-4 text-xs text-amber-700">Changing these fields requires administrator re-verification.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">Organization name</label>
                  <input className="input" value={orgName} onChange={(event) => setOrgName(event.target.value)} required />
                </div>
                {profile.role === 'donor' && (
                  <div>
                    <label className="label">Organization type</label>
                    <select className="input" value={orgType} onChange={(event) => setOrgType(event.target.value)}>
                      <option value="restaurant">Restaurant</option><option value="supermarket">Supermarket</option>
                      <option value="hotel">Hotel</option><option value="bakery">Bakery</option><option value="other">Other</option>
                    </select>
                  </div>
                )}
                {profile.role === 'ngo' && (
                  <div>
                    <label className="label">Capacity (meals/day)</label>
                    <input className="input" type="number" min={1} max={100000} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="label">Address</label>
                  <input className="input" value={address} onChange={(event) => setAddress(event.target.value)} required />
                  <p className="mt-1 text-xs text-gray-400">Changing the address also updates the map location.</p>
                </div>
                {profile.role === 'ngo' && (
                  <div className="sm:col-span-2">
                    <label className="label">Accepted food types</label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {FOOD_TYPES.map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-sm">
                          <input type="checkbox" checked={acceptedFoods.includes(value)} onChange={(event) => setAcceptedFoods((items) => event.target.checked ? [...items, value] : items.filter((item) => item !== value))} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {profile.role === 'volunteer' && (
            <div className="card">
              <h2 className="section-title mb-1">Volunteer settings</h2>
              <p className="mb-4 text-xs text-amber-700">Transport and service-area changes require administrator re-verification.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Vehicle</label><select className="input" value={vehicle} onChange={(event) => setVehicle(event.target.value)}><option value="none">On foot</option><option value="bike">Bicycle</option><option value="motorbike">Motorbike</option><option value="car">Car</option><option value="van">Van</option></select></div>
                <div><label className="label">Maximum carry (kg)</label><input className="input" type="number" min={0} step="0.1" value={maxCarryKg} onChange={(event) => setMaxCarryKg(Number(event.target.value))} /></div>
                <div><label className="label">Service radius (km)</label><input className="input" type="number" min={1} max={100} step="0.1" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /></div>
                <div><label className="label">New service area</label><input className="input" value={serviceArea} onChange={(event) => setServiceArea(event.target.value)} placeholder="Only enter this to change location" /></div>
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm sm:col-span-2">
                  <input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} />
                  Available for new pickup assignments
                </label>
              </div>
            </div>
          )}
        </fieldset>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="font-mono text-xs text-gray-400 hover:text-gray-600" onClick={() => { navigator.clipboard.writeText(profile.id); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? 'Account ID copied!' : `Account ID: ${profile.id.slice(0, 8)}…`}
          </button>
          <button className="btn-primary" disabled={!verified || busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}
