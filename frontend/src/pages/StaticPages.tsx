import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Footer } from './Landing';

/** Shared wrapper for public info pages: top nav + footer. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-gray-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Icon name="leaf" className="h-5 w-5" />
            </span>
            FoodBridge
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
            <Link to="/about" className="hover:text-gray-900">About</Link>
            <Link to="/how-it-works" className="hover:text-gray-900">How it works</Link>
            <Link to="/contact" className="hover:text-gray-900">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost">Sign in</Link>
            <Link to="/signup" className="btn-primary">Get started</Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <Footer />
    </div>
  );
}

export function About() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-4xl font-bold text-gray-900">About FoodBridge</h1>
        <p className="mt-4 text-lg leading-relaxed text-gray-600">
          Roughly one-third of all food produced globally is wasted, while millions go hungry —
          often in the same city, sometimes on the same street. The problem usually isn't a lack of
          goodwill. It's logistics: surplus food is perishable, donors don't know who can take it in
          time, and charities can't see what's available nearby.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-gray-600">
          FoodBridge closes that gap with software. Our AI estimates how long each donation stays
          safe, geo-matching finds the closest suitable shelter within that window, and volunteers
          are routed to carry it — with QR-verified handoffs so every meal is accounted for.
        </p>

        <h2 className="mt-12 font-display text-2xl font-bold text-gray-900">What we believe</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { icon: 'clock' as const, title: 'Speed matters', text: 'Perishable food is a race against time. Every minute of friction costs meals.' },
            { icon: 'shield' as const, title: 'Trust is earned', text: 'Verified organizations, audited handoffs, and a full status trail for every donation.' },
            { icon: 'chart' as const, title: 'Impact is measurable', text: 'If it isn\'t counted, it didn\'t happen. We measure meals, kilograms and CO₂e.' },
          ].map((v) => (
            <div key={v.title} className="card">
              <Icon name={v.icon} className="mb-2 h-5 w-5 text-brand-600" />
              <h3 className="font-semibold text-gray-900">{v.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{v.text}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 font-display text-2xl font-bold text-gray-900">The technology</h2>
        <p className="mt-4 leading-relaxed text-gray-600">
          FoodBridge is built on interpretable AI — a spoilage model grounded in USDA food-safety
          guidance, a transparent matching score combining distance, capacity, food-type fit and
          reliability, and demand forecasting that improves as the network grows. Location search
          runs on PostGIS; every handoff is sealed with single-use QR tokens.
        </p>

        <div className="mt-10">
          <Link to="/signup" className="btn-primary !px-6 !py-3">
            Join the network <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}

export function HowItWorks() {
  const flows = [
    {
      role: 'For donors',
      icon: 'building' as const,
      steps: [
        'Create a donor account with your organization\'s location',
        'List surplus food in under a minute — type, quantity, prep time, storage',
        'AI stamps the safe pickup window; nearby NGOs are notified',
        'When a volunteer arrives, show your pickup QR code',
        'Track the delivery and your cumulative impact on your dashboard',
      ],
    },
    {
      role: 'For NGOs & shelters',
      icon: 'heart' as const,
      steps: [
        'Register your shelter with capacity and accepted food types',
        'Browse live listings on a map or get matched automatically',
        'Claim a donation and assign a recommended volunteer',
        'Show your delivery QR when the volunteer arrives',
        'Confirm receipt — the donation is verified and counted',
      ],
    },
    {
      role: 'For volunteers',
      icon: 'truck' as const,
      steps: [
        'Sign up with your vehicle type and service radius',
        'Get pickup tasks that fit your area',
        'Accept, navigate with the built-in map',
        'Scan the donor\'s QR at pickup, the NGO\'s QR at delivery',
        'Build your delivery history and reliability score',
      ],
    },
  ];
  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-center font-display text-4xl font-bold text-gray-900">How FoodBridge works</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
          Three roles, one chain of custody — from surplus to served.
        </p>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {flows.map((f) => (
            <div key={f.role} className="card">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon name={f.icon} className="h-5 w-5" />
                </span>
                <h2 className="font-display font-bold text-gray-900">{f.role}</h2>
              </div>
              <ol className="space-y-3">
                {f.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-600">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link to="/signup" className="btn-primary !px-6 !py-3">Get started free</Link>
        </div>
      </div>
    </PublicShell>
  );
}

export function Contact() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-4xl font-bold text-gray-900">Contact us</h1>
        <p className="mt-3 text-gray-600">
          Questions about onboarding your organization, partnerships, or press? We'd love to hear from you.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="card">
            <Icon name="mail" className="mb-2 h-5 w-5 text-brand-600" />
            <p className="font-semibold text-gray-900">Email</p>
            <p className="mt-1 text-sm text-gray-600">hello@foodbridge.example</p>
          </div>
          <div className="card">
            <Icon name="phone" className="mb-2 h-5 w-5 text-brand-600" />
            <p className="font-semibold text-gray-900">Phone</p>
            <p className="mt-1 text-sm text-gray-600">+880 1XXX-XXXXXX</p>
          </div>
          <div className="card sm:col-span-2">
            <Icon name="pin" className="mb-2 h-5 w-5 text-brand-600" />
            <p className="font-semibold text-gray-900">Office</p>
            <p className="mt-1 text-sm text-gray-600">Dhaka, Bangladesh</p>
          </div>
        </div>
        <div className="card mt-6">
          <p className="font-semibold text-gray-900">Send a message</p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              alert('Thanks! This demo form does not send yet — email us instead.');
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Name</label>
                <input className="input" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" required />
              </div>
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="input" rows={4} required />
            </div>
            <button className="btn-primary">Send message</button>
          </form>
        </div>
      </div>
    </PublicShell>
  );
}

export function NotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-display text-7xl font-extrabold text-brand-200">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-gray-600">The page you're looking for doesn't exist or has moved.</p>
        <Link to="/" className="btn-primary mt-6">Back to home</Link>
      </div>
    </PublicShell>
  );
}
