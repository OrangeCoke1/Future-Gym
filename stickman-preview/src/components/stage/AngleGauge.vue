<script setup>
// Bottom right of the stage: the tracked joint's angle, a half-circle protractor with the counting band, and the rule.
import { ref, computed } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine, useFrame } from '../../composables/useEngine.js';
import { useChart } from '../../composables/useChart.js';
import { ACT } from '../../core/actions.js';
import { ruleOf } from '../../engine/reps.js';
import { drawAng } from '../../charts/angle.js';

const { t } = useI18n();
const { live } = useEngine();
const A = computed(() => ACT[live.action]);
const rule = computed(() => (live.camOn && A.value.rep.cam && A.value.rep.cam.rule) || A.value.rule);
const cv = ref(null), ch = useChart(cv), ang = ref(null);
useFrame(S => {
  if (!ch.value) return;
  const { g, w, h } = ch.value;
  if (S.curAngle == null) { g.clearRect(0, 0, w, h); return; }
  drawAng(ch.value, { curAngle: S.curAngle, curAngle2: S.curAngle2, th: ruleOf(S).th, dark: S.dark });
});
useFrame(S => { ang.value = S.curAngle == null ? null : { side: S.curSide, v: Math.round(S.curAngle) }; }, true);
</script>

<template>
  <div class="st st-br">
    <div :hidden="!A.show">
      <div class="k">
        <span>{{ A.show ? t(A.rep.type === 'steps' ? '膝角' : '关节角度（3D）') : '' }}</span><b class="kv">{{ ang ? t(ang.side === 'L' ? '左 {0}°' : '右 {0}°', ang.v) : '—' }}</b>
      </div>
      <canvas
        ref="cv"
        class="chart g-ang"
        :aria-label="t('关节角度刻度：左右两侧的当前角度和计数阈值')"
      />
    </div>
    <p class="rule">
      {{ t(rule) }}
    </p>
  </div>
</template>
