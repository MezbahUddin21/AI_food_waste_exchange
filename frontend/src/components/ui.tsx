import { ReactNode } from 'react';
import { Icon, IconName } from './Icon';

export function EmptyState({
  icon = 'package',
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon name={icon} className="h-7 w-7" />
      </div>
      <p className="font-semibold text-gray-900">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-gray-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-3">
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-4 w-1/2" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card flex items-start gap-4 ${accent ? 'border-brand-200 bg-gradient-to-br from-brand-50 to-white' : ''}`}>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          accent ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'
        }`}
      >
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-gray-500">{label}</p>
        <p className="font-display text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
