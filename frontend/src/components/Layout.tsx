import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { get, onColdStart, post } from '../lib/api';
import { Icon, IconName } from './Icon';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  read: boolean;
  created_at: string;
}

const NAV: Record<string, { to: string; label: string; icon: IconName }[]> = {
  donor: [
    { to: '/app', label: 'My donations', icon: 'package' },
    { to: '/app/donations/new', label: 'List food', icon: 'plus' },
    { to: '/app/impact', label: 'My impact', icon: 'chart' },
  ],
  ngo: [
    { to: '/app', label: 'Browse food', icon: 'map' },
    { to: '/app/claims', label: 'My claims', icon: 'heart' },
    { to: '/app/emergency', label: 'Emergency', icon: 'alert' },
    { to: '/app/impact', label: 'Impact', icon: 'chart' },
  ],
  volunteer: [
    { to: '/app', label: 'My tasks', icon: 'truck' },
    { to: '/app/impact', label: 'Impact', icon: 'chart' },
  ],
  government: [{ to: '/app', label: 'Analytics', icon: 'chart' }],
  admin: [
    { to: '/app', label: 'Dashboard', icon: 'home' },
    { to: '/app/impact', label: 'Analytics', icon: 'chart' },
    { to: '/app/admin', label: 'Verifications', icon: 'shield' },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  donor: 'Food Donor',
  ngo: 'NGO / Shelter',
  volunteer: 'Volunteer',
  government: 'Government',
  admin: 'Administrator',
};

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [waking, setWaking] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => onColdStart(setWaking), []);

  useEffect(() => {
    const load = () => get<Notification[]>('/notifications').then(setNotifications).catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;
  const links = profile ? NAV[profile.role] ?? [] : [];
  const initials = (profile?.full_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const notificationTarget = (n: Notification): string => {
    if (n.data?.emergency_request_id) return '/app/emergency';
    if (n.type === 'assignment_offered' || n.type === 'assignment_accepted') return '/app';
    if (n.data?.donation_id) return `/app/donations/${n.data.donation_id}`;
    return '/app';
  };

  const openNotification = async (n: Notification) => {
    setShowNotif(false);
    if (!n.read) {
      setNotifications((ns) => ns.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      post(`/notifications/${n.id}/read`).catch(() => {});
    }
    navigate(notificationTarget(n));
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === '/app'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
        >
          <Icon name={l.icon} className="h-4.5 w-4.5 h-5 w-5" />
          {l.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      {waking && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-800">
          Waking up the free-tier server — this can take ~30–50 seconds…
        </div>
      )}

      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button className="btn-ghost !p-2 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Menu">
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <Link to="/app" className="flex items-center gap-2 font-display text-lg font-bold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Icon name="leaf" className="h-5 w-5" />
              </span>
              <span className="hidden sm:inline">FoodBridge</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                className="btn-ghost relative !p-2.5"
                onClick={() => setShowNotif((s) => !s)}
                aria-label="Notifications"
              >
                <Icon name="bell" className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4.5 min-w-4.5 h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-gray-100 p-3">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unread > 0 && (
                      <button
                        className="text-xs font-medium text-brand-600 hover:underline"
                        onClick={async () => {
                          await post('/notifications/read-all');
                          setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 && (
                      <div className="flex flex-col items-center py-10 text-gray-400">
                        <Icon name="bell" className="mb-2 h-6 w-6" />
                        <p className="text-sm">You're all caught up</p>
                      </div>
                    )}
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        className={`block w-full border-b border-gray-50 p-3 text-left last:border-0 hover:bg-gray-50 ${n.read ? '' : 'bg-brand-50/60'}`}
                        onClick={() => openNotification(n)}
                      >
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{n.body}</p>
                        <p className="mt-1 text-[11px] text-gray-400">{new Date(n.created_at).toLocaleString()}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" ref={userRef}>
              <button
                className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-gray-100"
                onClick={() => setShowUser((s) => !s)}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {initials}
                </span>
                <span className="hidden text-left md:block">
                  <span className="block max-w-32 truncate text-sm font-medium leading-tight text-gray-900">
                    {profile?.full_name}
                  </span>
                  <span className="block text-[11px] leading-tight text-gray-500">
                    {profile ? ROLE_LABEL[profile.role] : ''}
                  </span>
                </span>
              </button>
              {showUser && (
                <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-gray-900">{profile?.full_name}</p>
                    <p className="truncate text-xs text-gray-500">{profile?.email}</p>
                  </div>
                  <Link
                    to="/app/profile"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowUser(false)}
                  >
                    <Icon name="settings" className="h-4 w-4" /> Profile & settings
                  </Link>
                  <button
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                    onClick={async () => {
                      await signOut();
                      navigate('/login');
                    }}
                  >
                    <Icon name="logout" className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Desktop sidebar */}
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-60 shrink-0 flex-col border-r border-gray-200 bg-white p-4 lg:flex">
          <NavLinks />
          <div className="mt-auto rounded-xl bg-brand-50 p-3.5 text-xs text-brand-800">
            <p className="font-semibold">💚 Every meal counts</p>
            <p className="mt-1 text-brand-700/80">
              Food listed here has saved{' '}
              <span className="font-semibold">real meals</span> from landfills.
            </p>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileNav && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileNav(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="absolute inset-y-0 left-0 w-64 bg-white p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display font-bold">Menu</span>
                <button className="btn-ghost !p-2" onClick={() => setMobileNav(false)}>
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>
              <NavLinks onNavigate={() => setMobileNav(false)} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
