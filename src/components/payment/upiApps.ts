/*
 * UPI app deeplinks: config + URL builder for the customer payment screen.
 *
 * RESEARCH NOTES (checked against web search results, Nov 2026; re-verify
 * before changing a scheme, schemes change between app releases):
 *
 * Generic link (NPCI UPI linking spec):
 *   upi://pay?pa=<payee VPA>&pn=<payee name>&am=<amount>&cu=INR&tn=<note>&tr=<txn ref>
 *   pa and pn are mandatory in the spec. am is the fixed amount. tr is a
 *   reference id many PSPs add. The NPCI parameter table was not retrievable
 *   here; the query string we get from the server (order.upiUrl) is reused
 *   verbatim for every app, so the amount and fingerprint never change.
 *
 * App-specific schemes (iOS, and Android when no package is targeted):
 *   Google Pay   tez://upi/pay?...          (gpay:// also seen in docs)   iOS: yes
 *   PhonePe      phonepe://pay?...                                       iOS: yes
 *   Paytm        paytmmp://pay?...  (paytm://upi/pay also seen)          iOS: yes
 *   CRED         credpay://upi/pay?...                                   iOS: per Solidgate table
 *   BHIM         bhim://upi/pay?...                                      UNVERIFIED on iOS
 *   Amazon Pay   amazonpay://upi/pay?...                                 UNVERIFIED
 *   WhatsApp, MobiKwik, Navi, Airtel Thanks, Jupiter: no iOS scheme we could
 *   verify. On iOS these fall back to the generic upi:// link.
 *
 * Android targeting a specific app:
 *   intent://pay?<query>#Intent;scheme=upi;package=<android package>;end
 *   If the package is not installed Chrome shows an error; the generic
 *   upi://pay link (no package) opens the system chooser of all UPI apps.
 *
 * Android packages used here:
 *   Google Pay   com.google.android.apps.nbu.paisa.user
 *   PhonePe      com.phonepe.app
 *   Paytm        net.one97.paytm
 *   BHIM         in.org.npci.upiapp            (not re-verified)
 *   Amazon Pay   in.amazon.mShop.android.shopping (not re-verified)
 *   CRED         com.dreamplug.androidapp      (not re-verified)
 *   WhatsApp     com.whatsapp
 *   MobiKwik     com.mobikwik_new
 *   Navi         com.naviapp
 *   Airtel Thanks com.myairtelapp
 *   Jupiter      money.jupiter
 *   SuperMoney   no verified package -> generic chooser on Android
 *
 * iOS limits: apps must be queryable for canOpenURL, and Safari only follows
 * a custom scheme when the app is installed. There is no reliable iOS
 * equivalent of the Android package-targeted intent. So on iOS the user is
 * given the app-specific scheme where known, and "Pay with another app" to
 * switch. Logos: simple-icons (CC0) for Google Pay, PhonePe, Paytm, Amazon
 * Pay, WhatsApp, Airtel. BHIM, CRED, MobiKwik, Navi, Jupiter, SuperMoney have
 * no simple-icons logo here, so they render as name badges.
 */

import googlePayLogo from '../../assets/upi-apps/googlepay.svg';
import phonePeLogo from '../../assets/upi-apps/phonepe.svg';
import paytmLogo from '../../assets/upi-apps/paytm.svg';
import amazonPayLogo from '../../assets/upi-apps/amazonpay.svg';
import whatsappLogo from '../../assets/upi-apps/whatsapp.svg';
import airtelLogo from '../../assets/upi-apps/airtel.svg';

export type UpiAppId =
  | 'gpay'
  | 'phonepe'
  | 'paytm'
  | 'bhim'
  | 'amazonpay'
  | 'cred'
  | 'whatsapp'
  | 'mobikwik'
  | 'navi'
  | 'supermoney'
  | 'airtel'
  | 'jupiter'
  | 'any';

export interface UpiApp {
  id: UpiAppId;
  label: string;
  logo?: string;
  /** Android package for an intent:// link. Omit to use the generic chooser. */
  androidPackage?: string;
  /** iOS scheme prefix, query string is appended. Omit to use upi://. */
  iosScheme?: string;
}

/** Shown in the first grid (2 or 3 columns). */
export const PRIMARY_UPI_APPS: UpiApp[] = [
  {
    id: 'gpay',
    label: 'Google Pay',
    logo: googlePayLogo,
    androidPackage: 'com.google.android.apps.nbu.paisa.user',
    iosScheme: 'tez://upi/pay',
  },
  {
    id: 'phonepe',
    label: 'PhonePe',
    logo: phonePeLogo,
    androidPackage: 'com.phonepe.app',
    iosScheme: 'phonepe://pay',
  },
  {
    id: 'paytm',
    label: 'Paytm',
    logo: paytmLogo,
    androidPackage: 'net.one97.paytm',
    iosScheme: 'paytmmp://pay',
  },
  {
    id: 'bhim',
    label: 'BHIM',
    androidPackage: 'in.org.npci.upiapp',
    iosScheme: 'bhim://upi/pay',
  },
  {
    id: 'amazonpay',
    label: 'Amazon Pay',
    logo: amazonPayLogo,
    androidPackage: 'in.amazon.mShop.android.shopping',
    iosScheme: 'amazonpay://upi/pay',
  },
  {
    id: 'cred',
    label: 'CRED',
    androidPackage: 'com.dreamplug.androidapp',
    iosScheme: 'credpay://upi/pay',
  },
];

/** Revealed by the "More apps" button. */
export const MORE_UPI_APPS: UpiApp[] = [
  { id: 'whatsapp', label: 'WhatsApp', logo: whatsappLogo, androidPackage: 'com.whatsapp' },
  { id: 'mobikwik', label: 'MobiKwik', androidPackage: 'com.mobikwik_new' },
  { id: 'navi', label: 'Navi', androidPackage: 'com.naviapp' },
  { id: 'supermoney', label: 'SuperMoney' },
  { id: 'airtel', label: 'Airtel Thanks', logo: airtelLogo, androidPackage: 'com.myairtelapp' },
  { id: 'jupiter', label: 'Jupiter', androidPackage: 'money.jupiter' },
];

/** Android only: the generic UPI chooser. Hidden on iOS. */
export const ANY_UPI_APP: UpiApp = { id: 'any', label: 'Any UPI app' };

export const ALL_UPI_APP_IDS: UpiAppId[] = [
  ...PRIMARY_UPI_APPS.map((a) => a.id),
  ...MORE_UPI_APPS.map((a) => a.id),
  'any',
];

export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

export function findUpiApp(id: UpiAppId): UpiApp | undefined {
  if (id === 'any') return ANY_UPI_APP;
  return [...PRIMARY_UPI_APPS, ...MORE_UPI_APPS].find((a) => a.id === id);
}

/** The "any" option only exists on Android. */
export function isUpiAppAvailable(id: UpiAppId, android: boolean): boolean {
  return id !== 'any' || android;
}

/**
 * Build the launch URL for one app from the server-generated upiUrl.
 * The query string is reused exactly (amount, paise and order fingerprint
 * untouched); only the scheme / intent wrapper changes.
 */
export function buildUpiAppUrl(app: UpiApp, upiUrl: string, android: boolean): string {
  const query = upiUrl.split('?')[1] ?? '';
  if (android) {
    if (app.androidPackage) {
      return `intent://pay?${query}#Intent;scheme=upi;package=${app.androidPackage};end`;
    }
    return `upi://pay?${query}`;
  }
  if (app.iosScheme) return `${app.iosScheme}?${query}`;
  return `upi://pay?${query}`;
}
