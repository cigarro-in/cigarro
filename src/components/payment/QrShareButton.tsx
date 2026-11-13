import { useState } from 'react';
import { Share2 } from 'lucide-react';

interface QrShareButtonProps {
  /** PNG data URL already rendered for the QR (same pixels as the screen). */
  qrDataUrl: string;
  filename: string;
  /** The UPI link; sent as text so a receiver can pay from the link too. */
  upiUrl: string;
  title: string;
}

function downloadPng(qrDataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = qrDataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Web Share with the QR as a PNG file plus the UPI link. Falls back to a PNG
 * download where file sharing is unavailable or fails.
 */
export function QrShareButton({ qrDataUrl, filename, upiUrl, title }: QrShareButtonProps) {
  const [busy, setBusy] = useState(false);

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await fetch(qrDataUrl).then((r) => r.blob());
      const file = new File([blob], filename, { type: 'image/png' });
      const canShareFiles =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({ files: [file], title, text: upiUrl });
      } else {
        downloadPng(qrDataUrl, filename);
      }
    } catch (err) {
      // User dismissing the share sheet is not a failure.
      if ((err as { name?: string })?.name !== 'AbortError') downloadPng(qrDataUrl, filename);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      disabled={busy}
      aria-label="Share UPI QR"
      className="inline-flex items-center gap-1.5 text-sm font-bold text-canyon hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-canyon rounded"
    >
      <Share2 className="w-4 h-4" aria-hidden="true" />
      {busy ? 'Sharing…' : 'Share QR'}
    </button>
  );
}
