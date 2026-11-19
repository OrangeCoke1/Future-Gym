<script setup>
// Bottom left of the stage: the rep (or step) counter, and for rep actions a 12-tick bar of the current set.
// Logged in, 保存本组 stores the count in the user's history now and counts afresh (engine.saveSet).
import { computed, ref } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine } from '../../composables/useEngine.js';
import { ACT } from '../../core/actions.js';
import { useAuth } from '../../stores/auth.js';

const SET = 12;
const { t } = useI18n();
const { engine, live } = useEngine();
const auth = useAuth();
const saved = ref(false);
let timer = 0;
function save() { engine.saveSet(); saved.value = true; clearTimeout(timer); timer = setTimeout(() => { saved.value = false; }, 1500); }
const type = computed(() => ACT[live.action].rep.type);
const bar = computed(() => type.value === 'angle' || type.value === 'cycle');
const inSet = computed(() => (live.count && live.count % SET === 0 ? SET : live.count % SET));
const setNo = computed(() => Math.floor(Math.max(0, live.count - 1) / SET) + 1);
</script>

<template>
  <div class="st st-bl">
    <div class="k">
      {{ t(type === 'steps' ? '步数' : type === 'none' ? '当前动作' : '完成次数') }}
    </div>
    <!-- CSS shrinks the numeral once it needs three or more digits -->
    <div
      class="count"
      aria-live="polite"
      :data-len="String(live.count).length"
    >
      {{ live.count }}
    </div>
    <div
      class="ticks"
      aria-hidden="true"
      :hidden="!bar"
    >
      <i
        v-for="i in SET"
        :key="i"
        :class="{ on: i <= inSet }"
      />
    </div>
    <div
      class="sub"
      :hidden="!bar"
    >
      {{ t('第 {0} 组 · 每组 {1} 次', setNo, SET) }}
    </div>
    <button
      v-if="auth.user && type !== 'none'"
      class="save-set"
      type="button"
      :disabled="!live.count && !saved"
      @click="save"
    >
      {{ saved ? t('已保存 ✓') : t('保存本组') }}
    </button>
  </div>
</template>
