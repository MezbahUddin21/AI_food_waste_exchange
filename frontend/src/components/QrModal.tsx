import { useEffect, useState } from 'react';
import { get } from '../lib/api';

/**
 * Shows a pickup or delivery QR for a donation's active assignment.
 * Resolves donation → assignment, then fetches the role-guarded QR image.
 */
export default function QrModal({
  donationId,
  kind,
  onClose,
}: {
  donationId: string;
  kind: 'pickup' | 'delivery';
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const assignment = await get<{ id: string }>(`/assignments/by-donation/${donationId}`);
        const qr = await get<{ data_url: string }>(`/assignments/${assignment.id}/qr/${kind}`);
        setDataUrl(qr.data_url);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [donationId, kind]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-lg font-semibold">
          {kind === 'pickup' ? 'Pickup verification QR' : 'Delivery verification QR'}
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          {kind === 'pickup'
            ? 'Show this to the volunteer when they arrive.'
            : 'Show this to the volunteer on arrival at your facility.'}
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {dataUrl ? (
          <img src={dataUrl} alt="QR code" className="mx-auto h-64 w-64" />
        ) : (
          !error && <p className="text-gray-400">Generating…</p>
        )}
        <button className="btn-outline mt-4 w-full" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
