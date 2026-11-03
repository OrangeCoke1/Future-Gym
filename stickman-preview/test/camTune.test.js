// pose/camTune.js: the camera-following tuning read from storage or the panel is always valid.
import { describe, test, expect } from 'vitest';
import { sanitizeTune, loadTune, CAM_TUNE_DEFAULT, CAM_TUNE_RANGE } from '../src/pose/camTune.js';

describe('sanitizeTune', () => {
  test('valid values pass through', () => {
    expect(sanitizeTune({ minCut: 2, beta: 10, lead: 30, legs: 'stand' })).toEqual({ minCut: 2, beta: 10, lead: 30, legs: 'stand' });
  });
  test('numbers are clamped to their range', () => {
    const t = sanitizeTune({ minCut: 99, beta: -5, lead: 1000, legs: 'normal' });
    expect(t).toEqual({ minCut: CAM_TUNE_RANGE.minCut[1], beta: CAM_TUNE_RANGE.beta[0], lead: CAM_TUNE_RANGE.lead[1], legs: 'normal' });
  });
  test('missing or invalid fields keep the fallback', () => {
    const fb = { minCut: 1, beta: 2, lead: 3, legs: 'stand' };
    expect(sanitizeTune({ minCut: 'x', beta: NaN, legs: 'run' }, fb)).toEqual(fb);
    expect(sanitizeTune({ lead: 40 }, fb)).toEqual({ ...fb, lead: 40 });
  });
  test('anything that is not an object gives the defaults', () => {
    for (const v of [null, undefined, 3, 'x']) expect(sanitizeTune(v)).toEqual({ ...CAM_TUNE_DEFAULT });
  });
});

describe('loadTune', () => {
  test('a saved tuning without a leg mode (older defaults) starts from the current defaults', () => {
    expect(loadTune({ minCut: 4, beta: 1, lead: 0 })).toEqual({ ...CAM_TUNE_DEFAULT });
    expect(loadTune(null)).toEqual({ ...CAM_TUNE_DEFAULT });
  });
  test('a current one is kept (and sanitised)', () => {
    expect(loadTune({ minCut: 4, beta: 1, lead: 999, legs: 'normal' })).toEqual({ minCut: 4, beta: 1, lead: CAM_TUNE_RANGE.lead[1], legs: 'normal' });
  });
});
