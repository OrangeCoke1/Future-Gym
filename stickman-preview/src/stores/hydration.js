// Today's water log, entered by hand (persisted). A new day starts an empty log.
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { load, save } from '../utils/storage.js';
import { sanitizeWater, dayKey, totalOf } from '../sim/hydration.js';

export const useHydration = defineStore('hydration', () => {
  const water = ref(load('stick.water', v => sanitizeWater(v)));
  /** roll over to a fresh log if the day has changed since it was loaded */
  const today = () => { if (water.value.day !== dayKey()) water.value = { day: dayKey(), log: [] }; };
  const total = computed(() => totalOf(water.value));
  const lastEntry = computed(() => water.value.log[water.value.log.length - 1] || null);
  function add(ml) { today(); water.value.log.push({ t: Date.now(), ml }); save('stick.water', water.value); }
  function undo() { water.value.log.pop(); save('stick.water', water.value); }
  return { water, total, lastEntry, today, add, undo };
});
