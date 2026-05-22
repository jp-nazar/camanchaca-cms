// Lightweight i18n loader — Spanish only.
import es from './i18n/es.js';

const fallback = es;
const registry = { es };

let currentLang = 'es';

function lookup(key) {
  return registry[currentLang]?.[key] ?? fallback[key] ?? key;
}

function format(s, vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function t(key, vars) {
  return format(lookup(key), vars);
}

export function tn(keyBase, n, vars = {}) {
  const key = keyBase + (n === 1 ? '_one' : '_other');
  return format(lookup(key), { n, ...vars });
}

const subscribers = new Set();

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function setLanguage(lang) {
  // Only Spanish is supported
  return;
}

export function getLanguage() {
  return currentLang;
}

export function getAvailableLanguages() {
  return [{ code: 'es', name: 'Español' }];
}

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('lang', currentLang);
}
