import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { post } from '../lib/api';
import { geocode } from '../lib/geocode';
import { useAuth } from './AuthContext';

type Role = 'donor' | 'ngo' | 'volunteer' | 'government';

export default function Signup() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role>('donor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState(100);
  const [vehicle, setVehicle] = useState('bike');
  const [radius, setRadius] = useState(10);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { session, profile, refreshProfile } = useAuth();

  // Already signed in but profile not registered yet (e.g. came back after
  // confirming email) → skip account creation, go straight to role setup.
  useEffect(() => {
    if (session && !profile) setStep(2);
  }, [session, profile]);

  const createAccount = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    // If email confirmation is enabled in Supabase, signUp returns no session —
    // without one we can't call the API in step 2. Try signing in directly
    // (works when confirmation is off); otherwise tell the user what to do.
    if (!data.session) {
      const { data: signIn } = await supabase.auth.signInWithPassword({ email, password });
      if (!signIn.session) {
        setBusy(false);
        setError(
          'Check your inbox and confirm your email, then sign in to finish registration. ' +
            '(Or disable "Confirm email" in Supabase Auth settings for instant signups.)',
        );
        return;
      }
    }
    setBusy(false);
    setStep(2);
  };

  const completeProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let location;
      if (role === 'donor' || role === 'ngo' || role === 'volunteer') {
        if (address) {
          const geo = await geocode(address);
          if (!geo) throw new Error('Address not found — try a simpler address');
          location = { lat: geo.lat, lng: geo.lng };
        } else if (role !== 'volunteer') {
          throw new Error('Address is required');
        }
      }
      await post('/auth/register-profile', {
        role,
        fullName,
        ...(role === 'donor' || role === 'ngo' ? { orgName, address, location } : {}),
        ...(role === 'ngo' ? { capacityMealsPerDay: capacity } : {}),
        ...(role === 'volunteer' ? { vehicleType: vehicle, serviceRadiusKm: radius, location } : {}),
      });
      await refreshProfile();
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-brand-700">Create account</h1>
        <p className="mb-6 text-sm text-gray-500">Step {step} of 2</p>

        {step === 1 && (
          <form onSubmit={createAccount} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Creating…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={completeProfile} className="space-y-4">
            <div>
              <label className="label">I am a…</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="donor">Food donor (restaurant, supermarket…)</option>
                <option value="ngo">NGO / shelter</option>
                <option value="volunteer">Volunteer</option>
                <option value="government">Government agency</option>
              </select>
            </div>
            <div>
              <label className="label">Full name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            {(role === 'donor' || role === 'ngo') && (
              <>
                <div>
                  <label className="label">Organization name</label>
                  <input className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City" required />
                </div>
              </>
            )}
            {role === 'ngo' && (
              <div>
                <label className="label">Capacity (meals / day)</label>
                <input className="input" type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
              </div>
            )}
            {role === 'volunteer' && (
              <>
                <div>
                  <label className="label">Vehicle</label>
                  <select className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                    <option value="none">On foot</option>
                    <option value="bike">Bicycle</option>
                    <option value="motorbike">Motorbike</option>
                    <option value="car">Car</option>
                    <option value="van">Van</option>
                  </select>
                </div>
                <div>
                  <label className="label">Service radius (km)</label>
                  <input className="input" type="number" min={1} max={100} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Your area (optional)</label>
                  <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Neighborhood, City" />
                </div>
              </>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Finish'}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-gray-500">
          Have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
