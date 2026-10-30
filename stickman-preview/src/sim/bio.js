// 2126 concept layer: body read-outs no present-day wearable gives you live. They are simulated — shaped like the
// real physiology (driven by heart rate and muscle effort) so they move plausibly, and labelled 模拟 in the UI.
import { clamp } from '../core/math.js';

/** @typedef {{ spo2: number, rr: number, temp: number, lac: number, smo2: number, sweat: number, rate: number }} BioState  rate = sweat ml per hour, sweat = ml so far */
/** @returns {BioState} */
export const createBio = () => ({ spo2: 98.6, rr: 13, temp: 36.7, lac: 1.0, smo2: 71, sweat: 0, rate: 150 });

const effort = hr => clamp((hr - 62) / 110, 0, 1);

/**
 * one frame
 * @param {BioState} BIO
 * @param {{ hr: number, musE: number, w: number, dt: number, now: number }} o  musE = smoothed muscle effort, w = body weight (kg)
 */
export function updateBio(BIO, { hr, musE, w, dt, now }) {
  const f = effort(hr), ease = tau => 1 - Math.exp(-dt / tau);
  BIO.spo2 = 98.6 - 3.2 * f * f + 0.15 * Math.sin(now / 2300);
  BIO.rr += (13 + 27 * f - BIO.rr) * ease(4);
  BIO.temp += (36.7 + 1.6 * f - BIO.temp) * ease(90);
  BIO.lac += (1 + 11 * Math.pow(Math.max(0, f - 0.5), 1.7) - BIO.lac) * ease(40);
  BIO.smo2 += (71 - 34 * musE * (0.4 + 0.6 * f) - BIO.smo2) * ease(3);
  BIO.rate = (150 + 1150 * Math.pow(f, 1.5)) * (w / 65);                       // ml per hour
  BIO.sweat += BIO.rate / 3600 * dt;
}

/**
 * display values derived from the state
 * @returns {{ txt: (number | string)[], dripDur: string, sweating: boolean, dropLevel: number }}
 *   txt = SpO₂, breaths, core temp, lactate, muscle O₂, HRV, sweat ml, sweat rate; dripDur = drip animation period (s);
 *   dropLevel = droplet gauge fill, nearly empty at rest, full at about 1.3 L/h
 */
export function bioView(BIO, hr) {
  const f = effort(hr), r = clamp((BIO.rate - 150) / 1150, 0, 1);
  return {
    txt: [Math.round(BIO.spo2), Math.round(BIO.rr), BIO.temp.toFixed(1), BIO.lac.toFixed(1), Math.round(BIO.smo2), Math.round(62 - 44 * f), Math.round(BIO.sweat), Math.round(BIO.rate / 10) * 10],
    dripDur: (2.4 - 2 * r).toFixed(1),            // the drop icon drips faster as the rate climbs
    sweating: BIO.rate > 230,
    dropLevel: 4 + 40 * r
  };
}
