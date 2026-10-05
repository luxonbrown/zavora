const PREFIX = 'zavora:';

/** Namespaced localStorage read with a safe fallback. Never throws. */
export function readStore(key, fallback = null) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Namespaced localStorage write. Never throws. */
export function writeStore(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — non-fatal */
  }
}

/** Namespaced localStorage delete. */
export function removeStore(key) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

const memoryFallback = new Map();

/** In-memory fallback for environments where localStorage is blocked. */
export function readMemory(key, fallback = null) {
  return memoryFallback.has(key) ? memoryFallback.get(key) : fallback;
}

export function writeMemory(key, value) {
  memoryFallback.set(key, value);
}
