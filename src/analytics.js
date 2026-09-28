// Google Analytics 4, cookieless.
//
// - No cookies and no local storage: `client_storage: 'none'`.
// - A random client_id is generated per page load and kept in memory only,
//   so events within one visit belong together, but visits are not linked.
// - Google signals and ad personalisation are switched off.
// - While the measurement ID is still the placeholder, nothing is loaded and
//   events are printed to the console instead, so you can see what would be sent.

import { GA_MEASUREMENT_ID } from './config.js';

const PLACEHOLDER = 'G-XXXXXXXXXX';
const enabled = GA_MEASUREMENT_ID && GA_MEASUREMENT_ID !== PLACEHOLDER;
const once = new Set();

function randomClientId() {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return `${a[0]}.${Math.floor(Date.now() / 1000)}`;
}

export function initAnalytics() {
  if (!enabled) {
    console.info('[analytics] placeholder measurement ID — events are logged here, not sent.');
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    client_storage: 'none',
    client_id: randomClientId(),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(s);
}

/** Send a GA4 event. */
export function track(name, params = {}) {
  if (!enabled) {
    console.debug('[analytics]', name, params);
    return;
  }
  window.gtag('event', name, params);
}

/** Send an event only once per key per page load (e.g. first rotation of each phone). */
export function trackOnce(key, name, params = {}) {
  if (once.has(key)) return;
  once.add(key);
  track(name, params);
}
