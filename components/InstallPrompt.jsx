'use client';

import { useEffect, useState } from 'react';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed, never show

    const dismissedBefore = sessionStorage.getItem('buylink-install-dismissed');
    if (dismissedBefore) {
      setDismissed(true);
      return;
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS Safari never fires beforeinstallprompt — show manual steps instead
    if (isIos()) setShowIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem('buylink-install-dismissed', '1');
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  if (dismissed || (!deferredPrompt && !showIosHint)) return null;

  return (
    <div className="bg-ink text-sand text-sm px-4 py-2 flex items-center justify-between gap-3">
      <p>
        {deferredPrompt
          ? 'Install BuyLink for quicker access.'
          : 'Add BuyLink to your Home Screen: tap Share, then "Add to Home Screen".'}
      </p>
      <div className="flex items-center gap-3 shrink-0">
        {deferredPrompt && (
          <button onClick={handleInstall} className="bg-sand text-ink text-xs px-3 py-1.5 rounded-md">
            Install
          </button>
        )}
        <button onClick={dismiss} className="text-sand/60 text-xs">
          ✕
        </button>
      </div>
    </div>
  );
}
