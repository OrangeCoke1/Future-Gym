// localStorage with the original `stick.*` keys. Reads go through a sanitiser so a malformed or outdated value
// falls back to a safe default instead of breaking the page; storage may be unavailable (private mode), so
// every access is guarded.

/**
 * @template T
 * @param {string} key @param {(v: unknown) => T} sanitize  turns whatever was stored (null if nothing) into a valid value
 * @returns {T}
 */
export function load(key, sanitize) {
  let v;
  try { v = JSON.parse(localStorage.getItem(key)); } catch { v = null; }
  return sanitize(v);
}
export function save(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or unavailable: keep the in-memory value */ }
}
export const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
/** v if it is a finite number within [lo, hi], else d */
export const numIn = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : d);
