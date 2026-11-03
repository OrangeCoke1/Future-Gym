// utils/storage.js: every read goes through a sanitiser, and storage that throws (private mode, full) never breaks the page.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { load, save, isObj, numIn } from '../src/utils/storage.js';

afterEach(() => vi.unstubAllGlobals());

/** an in-memory localStorage */
const memory = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

describe('guards', () => {
  test('isObj: plain objects only', () => {
    expect(isObj({})).toBe(true);
    for (const v of [null, undefined, [], 'x', 1, true]) expect(isObj(v)).toBe(false);
  });
  test('numIn: finite numbers inside the range, else the default', () => {
    expect(numIn(2, 0, 3, 9)).toBe(2);
    expect(numIn(0, 0, 3, 9)).toBe(0);
    for (const v of [5, -1, NaN, Infinity, '2', null, undefined]) expect(numIn(v, 0, 3, 9)).toBe(9);
  });
});

describe('load / save', () => {
  test('round trip through JSON', () => {
    const ls = memory();
    vi.stubGlobal('localStorage', ls);
    save('stick.x', { a: 1 });
    expect(ls.m.get('stick.x')).toBe('{"a":1}');
    expect(load('stick.x', v => v)).toEqual({ a: 1 });
  });
  test('nothing stored or bad JSON: the sanitiser gets null', () => {
    vi.stubGlobal('localStorage', memory({ 'stick.bad': '{nope' }));
    const seen = [];
    load('stick.none', v => seen.push(v));
    load('stick.bad', v => seen.push(v));
    expect(seen).toEqual([null, null]);
  });
  test('storage that throws: load falls back, save is a no-op', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } });
    expect(load('stick.x', v => (v === null ? 'default' : v))).toBe('default');
    expect(() => save('stick.x', 1)).not.toThrow();
  });
});
