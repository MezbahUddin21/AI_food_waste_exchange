import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { get, onColdStart, post } from '../lib/api';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  read: boolean;
  created_at: string;
}

const NAV: Record<string, { to: string; label: string }[]> = {
  donor: [
    { to: '/', label: 'My donations' },
    { to: '/donations/new', label: 'List food' },
  ],
  ngo: [
    { to: '/', label: 'Browse food' },
    { to: '/claims', label: 'My claims' },
    { to: '/emergency', label: 'Emergency' },
  ],
  volunteer: [{ to: '/', label: 'My tasks' }],
  government: [{ to: '/', label: 'Analytics' }],
  admin: [
    { to: '/', label: 'Analytics' },
    { to: '/admin', label: 'Admin' },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [waking, setWaking] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => onColdStart(setWaking), []);

  useEffect(() => {
    const load = () => get<Notification[]>('/notifications').then(setNotifications).catch(() => {});
    load();
    const id = setInterval(load, 30_000); // simple poll; Realtime is a Phase-5+ upgrade
    return () => clearInterval(id);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;
  const links = profile ? NAV[profile.role] ?? [] : [];

  /** Where a notification should take the user, based on its payload/type. */
  const notificationTarget = (n: Notification): string => {
    if (n.data?.emergency_request_id) return '/emergency';
    if (n.type === 'assignment_offered' || n.type === 'assignment_accepted') return '/'; // volunteer task list
    if (n.data?.donation_id) return `/donations/${n.data.donation_id}`;
    return '/';
  };

  const openNotification = async (n: Notification) => {
    setShowNotif(false);
    if (!n.read) {
      setNotifications((ns) => ns.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      post(`/notifications/${n.id}/read`).catch(() => {});
    }
    navigate(notificationTarget(n));
  };

  return (
    <div className="min-h-screen">
      {waking && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-800">
          Waking up the free-tier server — this can take ~30–50 seconds…
        </div>
      )}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold text-brand-700">
            🥗 Food Waste Exchange
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="relative">
              <button
                className="btn-outline relative ml-2 !px-3"
                onClick={() => setShowNotif((s) => !s)}
                title="Notifications"
              >
                🔔
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    {unread}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b p-3">
                    <span className="text-sm font-semibold">Notifications</span>
                    <button
                      className="text-xs text-brand-600 hover:underline"
                      onClick={async () => {
                        await post('/notifications/read-all');
                        setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
                      }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 && (
                      <p className="p-4 text-sm text-gray-500">Nothing yet</p>
                    )}
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        className={`block w-full border-b p-3 text-left last:border-0 hover:bg-gray-50 ${n.read ? '' : 'bg-brand-50'}`}
                        onClick={() => openNotification(n)}
                      >
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-gray-600">{n.body}</p>
                        <p className="mt-1 text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              className="btn-outline ml-2"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
