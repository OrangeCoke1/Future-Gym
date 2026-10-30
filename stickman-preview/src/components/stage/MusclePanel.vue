<script setup>
// Top right of the stage: working muscles (effort now and accumulated fatigue, simulated), predicted recovery, facing.
import { ref, shallowRef, watch } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine, useFrame } from '../../composables/useEngine.js';

const { t } = useI18n();
const { engine, live } = useEngine();
// one entry per row of S.rows: shown percentage and bar widths (the bars move every frame, the number when it changes)
const rows = shallowRef([]);
const recovery = ref(0), facing = ref({ key: '正面', deg: 0 });
const build = () => { rows.value = engine.S.rows.map(r => ({ name: r.name, p: ref(0), dp: ref('0%'), df: ref('0%') })); };
watch(() => live.action, build, { immediate: true });
useFrame(S => {
  S.rows.forEach((r, i) => {
    const v = rows.value[i]; if (!v) return;
    v.dp.value = r.dp.toFixed(2) + '%'; v.df.value = r.df.toFixed(2) + '%'; v.p.value = Math.round(r.dp);
  });
  recovery.value = S.recovery;
});
useFrame(S => { facing.value = S.facing; }, true);
</script>

<template>
  <div class="st st-tr">
    <div :hidden="!rows.length">
      <div class="k">
        {{ t('发力肌群') }}<span
          class="est"
          data-k="sim"
        >{{ t('模拟') }}</span>
      </div>
      <ol class="mus">
        <li
          v-for="r in rows"
          :key="r.name"
        >
          <span>{{ t(r.name) }}</span><b>{{ r.p.value }}%</b><i :style="{ '--v': r.dp.value }" /><i
            class="f"
            :style="{ '--v': r.df.value }"
          />
        </li>
      </ol>
      <div class="sub key">
        <i class="a" />{{ t('当前发力') }}<i class="f" />{{ t('累计疲劳') }}
      </div>
    </div>
    <div class="sub">
      {{ recovery ? t('预计恢复 约 {0} 小时', recovery) : t('已恢复') }}
    </div>
    <div class="sub">
      {{ t(facing.key) }} {{ facing.deg }}°
    </div>
  </div>
</template>
