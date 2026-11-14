import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useOrgInfo } from '../../../lib/org/OrgContext';
import { readStoredPreference, writeStoredPreference } from '../../../lib/browserStorage';
import { Banner, Button } from '../../ui';
import { isIosBrowser, isStandaloneApp } from '../notifications/usePushNotifications';
import { clearInstallPrompt, getInstallPrompt, subscribeInstallPrompt } from './installPrompt';

/**
 * Overview prompt to install this store's admin as an app. Android and desktop
 * get the browser's install button; iOS gets the Share > Add to Home Screen steps
 * (Safari cannot show a prompt, and push needs the Home Screen app on iOS).
 * Hidden once installed; "Not now" is remembered per store on this browser.
 */
export function InstallAppCard() {
  const { slug } = useOrgInfo();
  const storageKey = `adminInstallDismissed:${slug}`;
  const [dismissed, setDismissed] = useState(() => readStoredPreference(storageKey) === '1');
  const [prompt, setPrompt] = useState(getInstallPrompt);
  const [installing, setInstalling] = useState(false);

  useEffect(() => subscribeInstallPrompt(() => setPrompt(getInstallPrompt())), []);

  if (dismissed || isStandaloneApp()) return null;
  const ios = isIosBrowser();
  if (!ios && !prompt) return null;

  const dismiss = () => {
    writeStoredPreference(storageKey, '1');
    setDismissed(true);
  };

  const install = async () => {
    if (!prompt) return;
    setInstalling(true);
    try {
      const current = prompt;
      clearInstallPrompt();
      const choice = await current.prompt();
      if (choice.outcome === 'accepted') dismiss();
    } catch {
      // The browser refused the prompt; the card stays so the admin can retry from the menu later.
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Banner
      tone="info"
      title="Install the admin app"
      onDismiss={dismiss}
      action={
        ios ? undefined : (
          <Button variant="primary" size="sm" icon={<Download />} loading={installing} onClick={() => void install()}>
            Install app
          </Button>
        )
      }
    >
      {ios
        ? 'Tap Share, then Add to Home Screen. Open the app from your Home Screen to get order notifications on iPhone.'
        : 'Install this admin as an app for faster access and order notifications.'}
    </Banner>
  );
}
