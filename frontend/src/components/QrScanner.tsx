import { useEffect, useRef, useState } from 'react';

/**
 * QR scanner using the native BarcodeDetector API (Chrome/Android — the realistic
 * volunteer device). Falls back to manual token entry elsewhere.
 */
export default function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (payload: { assignment_id: string; kind: string; token: string }) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState(true);
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setSupported(false);
      return;
    }
    const detector = new Detector({ formats: ['qr_code'] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (videoRef.current?.readyState === 4) {
            const codes = await detector.detect(videoRef.current).catch(() => []);
            if (codes.length) {
              try {
                onResult(JSON.parse(codes[0].rawValue));
                return; // stop loop; parent closes
              } catch {
                setError('Unrecognized QR code');
              }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setSupported(false);
      }
    })();

    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 font-semibold">Scan QR code</h2>
        {supported ? (
          <video ref={videoRef} className="mx-auto w-full rounded-lg" muted playsInline />
        ) : (
          <div className="space-y-2 text-left">
            <p className="text-sm text-gray-500">
              Camera scanning isn't supported in this browser. Paste the code payload instead:
            </p>
            <input className="input" value={manual} onChange={(e) => setManual(e.target.value)} placeholder='{"assignment_id":…}' />
            <button
              className="btn-primary w-full"
              onClick={() => {
                try {
                  onResult(JSON.parse(manual));
                } catch {
                  setError('Invalid payload');
                }
              }}
            >
              Submit
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button className="btn-outline mt-3 w-full" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
