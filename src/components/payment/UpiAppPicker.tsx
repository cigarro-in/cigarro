import { useState } from 'react';
import {
  ALL_UPI_APP_IDS,
  ANY_UPI_APP,
  MORE_UPI_APPS,
  PRIMARY_UPI_APPS,
  buildUpiAppUrl,
  findUpiApp,
  isAndroid,
  isUpiAppAvailable,
  isUpiAppOffered,
  type UpiApp,
  type UpiAppId,
} from './upiApps';
import { QrShareButton } from './QrShareButton';

const storageKey = (orgSlug: string) => `cigarro:upi-app:${orgSlug}`;

function readRemembered(orgSlug: string): UpiAppId | null {
  try {
    const v = localStorage.getItem(storageKey(orgSlug));
    if (!v || !(ALL_UPI_APP_IDS as string[]).includes(v)) return null;
    const id = v as UpiAppId;
    return isUpiAppAvailable(id, isAndroid()) ? id : null;
  } catch {
    return null;
  }
}

function writeRemembered(orgSlug: string, id: UpiAppId) {
  try {
    localStorage.setItem(storageKey(orgSlug), id);
  } catch {
    /* private mode / blocked storage: picker shows again next visit */
  }
}

interface UpiPayControlsProps {
  upiUrl: string;
  orgSlug: string;
  /** Needed for the iOS "Other app?" share footer. */
  qrDataUrl?: string;
  qrFilename?: string;
  title?: string;
}

/**
 * Pay button + app picker. First visit: Pay opens the picker, never launches.
 * After a choice is remembered (per store), Pay launches that app directly and
 * "Pay with another app" reopens the picker.
 */
export function UpiPayControls({ upiUrl, orgSlug, qrDataUrl, qrFilename, title }: UpiPayControlsProps) {
  const android = isAndroid();
  const [remembered, setRemembered] = useState<UpiAppId | null>(() => readRemembered(orgSlug));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const rememberedApp = remembered ? findUpiApp(remembered) : undefined;
  const primaryApps = PRIMARY_UPI_APPS.filter((a) => isUpiAppOffered(a, android));
  const moreApps = MORE_UPI_APPS.filter((a) => isUpiAppOffered(a, android));

  const launch = (app: UpiApp) => {
    const url = buildUpiAppUrl(app, upiUrl, android);
    if (url) window.location.href = url;
  };

  const pick = (app: UpiApp) => {
    writeRemembered(orgSlug, app.id);
    setRemembered(app.id);
    setPickerOpen(false);
    setShowMore(false);
    launch(app);
  };

  const onPay = () => {
    if (rememberedApp) {
      launch(rememberedApp);
      return;
    }
    setPickerOpen(true);
  };

  const showPicker = pickerOpen || !rememberedApp;

  const appButton = (app: UpiApp) => (
    <button
      key={app.id}
      type="button"
      onClick={() => pick(app)}
      aria-label={`Pay with ${app.label}`}
      className="min-h-[72px] rounded-xl border border-coyote/30 bg-white/60 px-1 py-2 flex flex-col items-center justify-center gap-1.5 hover:border-canyon transition-colors focus-visible:outline-2 focus-visible:outline-canyon"
    >
      {app.logo ? (
        <img src={app.logo} alt="" className="h-6 max-w-[64px] object-contain" />
      ) : (
        <span className="h-6 flex items-center text-[13px] font-extrabold tracking-tight text-dark">{app.label}</span>
      )}
      {app.logo && <span className="text-[11px] font-semibold text-dark leading-none">{app.label}</span>}
    </button>
  );

  return (
    <div className="w-full space-y-3">
      <button
        type="button"
        onClick={onPay}
        className="w-full h-14 rounded-xl bg-dark text-creme-light font-medium shadow-lg transition-transform active:scale-95 hover:bg-canyon"
      >
        {rememberedApp ? `Pay with ${rememberedApp.label}` : 'Pay now'}
      </button>

      {rememberedApp && !pickerOpen && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="text-xs font-bold text-canyon hover:underline"
        >
          Pay with another app
        </button>
      )}

      {showPicker && (
        <div className="bg-white/60 border border-coyote/20 rounded-2xl p-3 text-left space-y-3">
          <p className="text-xs text-coyote uppercase tracking-widest font-bold">Choose a UPI app</p>
          <div className="grid grid-cols-3 gap-2">{primaryApps.map(appButton)}</div>

          {showMore && (
            <div className="space-y-3">
              {moreApps.length > 0 && <div className="grid grid-cols-3 gap-2">{moreApps.map(appButton)}</div>}
              {!android && qrDataUrl && qrFilename && title && (
                <div className="pt-2 border-t border-coyote/20 space-y-2">
                  <p className="text-xs text-coyote leading-relaxed">
                    Other app? Share or save the QR and pay from your app.
                  </p>
                  <QrShareButton qrDataUrl={qrDataUrl} filename={qrFilename} upiUrl={upiUrl} title={title} />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowMore((s) => !s)}
              className="h-10 rounded-xl text-sm font-bold text-canyon hover:underline"
            >
              {showMore ? 'Fewer apps' : 'More apps'}
            </button>
            {android && (
              <button
                type="button"
                onClick={() => pick(ANY_UPI_APP)}
                className="h-11 rounded-xl border border-coyote/30 text-sm font-bold text-dark hover:border-canyon transition-colors"
              >
                {ANY_UPI_APP.label}
              </button>
            )}
            {rememberedApp && (
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setShowMore(false);
                }}
                className="h-9 text-xs text-coyote hover:text-dark"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
