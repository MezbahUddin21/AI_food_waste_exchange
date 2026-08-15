import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';
import { get } from '../lib/api';

const FEATURES = [
  {
    icon: 'sparkles' as const,
    title: 'AI spoilage prediction',
    text: 'Every listing gets a science-based safe pickup window from food type, prep time, storage and temperature — so nothing unsafe moves.',
  },
  {
    icon: 'map' as const,
    title: 'Smart NGO matching',
    text: 'PostGIS-powered geo search plus an ML ranking of distance, capacity, food-type fit and reliability finds the best recipient in seconds.',
  },
  {
    icon: 'qr' as const,
    title: 'QR-verified handoffs',
    text: 'Pickup and delivery are confirmed by scanning QR codes at each handoff — a tamper-proof chain of custody from kitchen to shelter.',
  },
  {
    icon: 'truck' as const,
    title: 'Volunteer logistics',
    text: 'Nearby volunteers with the right vehicle and radius are recommended automatically and guided with live maps.',
  },
  {
    icon: 'alert' as const,
    title: 'Emergency broadcasts',
    text: 'Shelters can broadcast urgent needs to every donor within a radius — critical during disasters and shortages.',
  },
  {
    icon: 'chart' as const,
    title: 'Impact analytics',
    text: 'Meals saved, kilograms diverted, CO₂e avoided, trends and leaderboards — for donors, NGOs and government oversight.',
  },
];

const STEPS = [
  { n: '01', title: 'List surplus food', text: 'A restaurant or store lists what they have. AI stamps the safe pickup window instantly.', role: 'Donor' },
  { n: '02', title: 'Claim & assign', text: 'The best-matched NGO claims it and assigns a nearby volunteer with one tap.', role: 'NGO' },
  { n: '03', title: 'Pick up — scan QR', text: 'The volunteer scans the donor’s QR code at pickup. Chain of custody starts.', role: 'Volunteer' },
  { n: '04', title: 'Deliver — scan QR', text: 'A second scan at the shelter confirms delivery. The NGO verifies receipt.', role: 'Volunteer' },
  { n: '05', title: 'Impact recorded', text: 'Meals saved and CO₂e avoided are added to live public analytics.', role: 'Everyone' },
];

export default function Landing() {
  const { session } = useAuth();
  const [stats, setStats] = useState<{ meals_saved: number; kg_diverted: number; co2e_avoided_kg: number } | null>(null);

  // Public teaser stats — best-effort, quietly skipped if not signed in.
  useEffect(() => {
    if (!session) return;
    get<{ meals_saved: number; kg_diverted: number; co2e_avoided_kg: number }>('/analytics/summary')
      .then(setStats)
      .catch(() => {});
  }, [session]);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-gray-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Icon name="leaf" className="h-4.5 w-4.5 h-5 w-5" />
            </span>
            FoodBridge
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#how" className="hover:text-gray-900">How it works</a>
            <Link to="/about" className="hover:text-gray-900">About</Link>
            <Link to="/contact" className="hover:text-gray-900">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Link to="/app" className="btn-primary">Open dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Sign in</Link>
                <Link to="/signup" className="btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(34,197,94,0.10),transparent)]" />
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center md:pt-24">
          <span className="badge mx-auto mb-5 border border-brand-200 bg-brand-50 text-brand-700">
            <Icon name="sparkles" className="h-3.5 w-3.5" /> AI-powered food rescue
          </span>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-6xl">
            Surplus food, delivered to people —{' '}
            <span className="text-brand-600">not landfills</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            FoodBridge connects restaurants, supermarkets and bakeries with nearby shelters and
            volunteers in real time. AI predicts spoilage windows, matches the best recipients, and
            QR codes verify every handoff.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup" className="btn-primary !px-6 !py-3 !text-base shadow-glow">
              Start donating <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
            <a href="#how" className="btn-outline !px-6 !py-3 !text-base">See how it works</a>
          </div>

          {/* Stats strip */}
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 divide-x divide-gray-200 rounded-2xl border border-gray-200 bg-white py-6 shadow-card">
            {[
              { v: stats ? String(stats.meals_saved) : '25+', l: 'meals saved' },
              { v: stats ? `${stats.kg_diverted} kg` : '12+ kg', l: 'food diverted' },
              { v: stats ? `${stats.co2e_avoided_kg} kg` : '30+ kg', l: 'CO₂e avoided' },
            ].map((s) => (
              <div key={s.l}>
                <p className="font-display text-2xl font-bold text-brand-600 md:text-3xl">{s.v}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-500 md:text-sm">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="border-y border-gray-100 bg-surface-muted py-14">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-gray-400">
            Built for the whole rescue chain
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { icon: 'building' as const, label: 'Restaurants & stores' },
              { icon: 'heart' as const, label: 'NGOs & shelters' },
              { icon: 'truck' as const, label: 'Volunteers' },
              { icon: 'shield' as const, label: 'Government' },
              { icon: 'users' as const, label: 'Communities' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-700">
                <Icon name={r.icon} className="h-4 w-4 text-brand-600" /> {r.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-gray-900 md:text-4xl">
            Everything a food rescue operation needs
          </h2>
          <p className="mt-3 text-gray-600">
            From listing to verified delivery — one platform, zero guesswork.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="card-hover animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon name={f.icon} className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-gray-100 bg-surface-muted py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-gray-900 md:text-4xl">
              From kitchen to shelter in five steps
            </h2>
            <p className="mt-3 text-gray-600">Every step is tracked, timestamped and verifiable.</p>
          </div>
          <ol className="mx-auto mt-12 max-w-3xl space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="card flex items-start gap-4">
                <span className="font-display text-2xl font-extrabold text-brand-200">{s.n}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{s.title}</h3>
                    <span className="badge bg-brand-50 text-brand-700">{s.role}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-700 px-6 py-14 text-center text-white md:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(255,255,255,0.15),transparent)]" />
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            One-third of all food is wasted. Let's fix your third.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Join as a donor, NGO or volunteer — it takes two minutes, and it's free.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="btn bg-white !px-6 !py-3 !text-base font-semibold text-brand-700 hover:bg-brand-50">
              Create free account
            </Link>
            <Link to="/how-it-works" className="btn border border-white/40 !px-6 !py-3 !text-base text-white hover:bg-white/10">
              Learn more
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-display text-lg font-bold text-gray-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Icon name="leaf" className="h-5 w-5" />
            </span>
            FoodBridge
          </div>
          <p className="mt-3 text-sm text-gray-500">
            The AI food waste exchange — connecting surplus with need, verifiably.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-gray-900">Platform</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><Link to="/signup" className="hover:text-brand-600">Become a donor</Link></li>
            <li><Link to="/signup" className="hover:text-brand-600">Register an NGO</Link></li>
            <li><Link to="/signup" className="hover:text-brand-600">Volunteer</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-gray-900">Company</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><Link to="/about" className="hover:text-brand-600">About us</Link></li>
            <li><Link to="/how-it-works" className="hover:text-brand-600">How it works</Link></li>
            <li><Link to="/contact" className="hover:text-brand-600">Contact</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-gray-900">Contact</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2"><Icon name="mail" className="h-4 w-4" /> hello@foodbridge.example</li>
            <li className="flex items-center gap-2"><Icon name="pin" className="h-4 w-4" /> Dhaka, Bangladesh</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} FoodBridge. Fighting food waste with technology.
      </div>
    </footer>
  );
}
