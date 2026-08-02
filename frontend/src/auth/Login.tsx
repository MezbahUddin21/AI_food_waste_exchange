import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '../components/Icon';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else navigate('/app');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(60%_50%_at_50%_0%,rgba(34,197,94,0.08),transparent)] p-4">
      <div className="card w-full max-w-md !p-8">
        <Link to="/" className="mb-6 flex items-center gap-2 font-display text-lg font-bold text-gray-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icon name="leaf" className="h-5 w-5" />
          </span>
          FoodBridge
        </Link>
        <h1 className="font-display text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">Sign in to continue rescuing food</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full !py-2.5" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-gray-500">
          No account?{' '}
          <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
