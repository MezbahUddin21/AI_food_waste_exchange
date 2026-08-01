const STATUS_STYLES: Record<string, string> = {
  listed: 'bg-blue-100 text-blue-800',
  claimed: 'bg-purple-100 text-purple-800',
  assigned: 'bg-indigo-100 text-indigo-800',
  in_transit: 'bg-amber-100 text-amber-800',
  delivered: 'bg-teal-100 text-teal-800',
  verified: 'bg-green-100 text-green-800',
  expired: 'bg-gray-200 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
