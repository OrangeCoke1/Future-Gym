<script setup>
// Panel · this session: what was done before each switch of exercise (kept until the page is reloaded).
import { computed } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine } from '../../composables/useEngine.js';

const { t } = useI18n();
const { engine, live } = useEngine();
// live.setsN changes whenever an entry is added or the log is cleared
const sets = computed(() => (live.setsN, [...engine.S.sets]));
const hm = ts => { const d = new Date(ts); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
</script>

<template>
  <section>
    <div class="k">
      {{ t('本次训练') }}<button
        class="mini"
        type="button"
        :hidden="!sets.length"
        @click="engine.clearSets()"
      >
        {{ t('清空') }}
      </button>
    </div>
    <ol
      class="sets"
      :hidden="!sets.length"
    >
      <li
        v-for="s in sets"
        :key="s.t"
      >
        <b>{{ t(s.name) }}</b><span class="n">×{{ s.n }} {{ t(s.unit) }}</span><time>{{ hm(s.t) }}</time><em>{{ t(s.src) }}</em>
      </li>
    </ol>
    <p
      class="empty"
      :hidden="!!sets.length"
    >
      {{ t('切换动作时，上一个动作完成的次数会记在这里。') }}
    </p>
  </section>
</template>
