<script setup>
// Panel · training history of the logged-in user: every visit's sets, saved in this browser's IndexedDB
// (stores/history.js), with an all-time total per exercise, a note per visit, and delete / clear. Deleting asks
// for a second click. Logged out, nothing is saved and only a hint is shown.
import { ref } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useHistory } from '../../stores/history.js';
import { useAuth } from '../../stores/auth.js';

const { t } = useI18n();
const h = useHistory();
const auth = useAuth();
const pad = n => String(n).padStart(2, '0');
const hm = ts => { const d = new Date(ts); return d.getHours() + ':' + pad(d.getMinutes()); };
const day = ts => { const d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm(ts); };
const mins = s => Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));

/** 'all' or a workout id waiting for the confirming click; it disarms itself after 3 s */
const armed = ref(null);
let timer = 0;
function confirmThen(key, f) {
  clearTimeout(timer);
  if (armed.value === key) { armed.value = null; f(); return; }
  armed.value = key; timer = setTimeout(() => { armed.value = null; }, 3000);
}
</script>

<template>
  <section>
    <div class="k">
      {{ t('训练历史') }}<button
        class="mini"
        type="button"
        :hidden="!h.workouts.length"
        @click="confirmThen('all', h.clear)"
      >
        {{ armed === 'all' ? t('再按一次确认') : t('全部删除') }}
      </button>
    </div>
    <p
      v-if="!auth.user"
      class="note"
    >
      {{ t('登录后可以保存训练记录。') }}
    </p>
    <p
      v-else-if="!h.ok"
      class="note"
    >
      {{ t('这个浏览器无法使用本地数据库，训练历史不会保存。') }}
    </p>
    <ul
      v-if="h.totals.length"
      class="tot"
      :aria-label="t('累计')"
    >
      <li
        v-for="x in h.totals"
        :key="x.action"
      >
        {{ t(x.name) }} <b>{{ x.n }}</b> {{ t(x.unit) }}
      </li>
    </ul>
    <ol
      v-if="h.workouts.length"
      class="hist"
    >
      <li
        v-for="s in h.workouts"
        :key="s.id"
      >
        <div class="hh">
          <b>{{ day(s.startedAt) }}</b><span>{{ t('{0} 分钟 · {1} 组 · {2} kcal', mins(s), s.setCount, s.kcal) }}</span><button
            class="mini"
            type="button"
            @click="confirmThen(s.id, () => h.remove(s.id))"
          >
            {{ armed === s.id ? t('再按一次确认') : t('删除') }}
          </button>
        </div>
        <ol class="sets">
          <li
            v-for="x in s.sets"
            :key="x.id"
          >
            <b>{{ t(x.name) }}</b><span class="n">×{{ x.n }} {{ t(x.unit) }}</span><time>{{ hm(x.t) }}</time><em>{{ t(x.src) }}</em>
          </li>
        </ol>
        <input
          class="memo"
          type="text"
          maxlength="200"
          :value="s.note"
          :placeholder="t('备注（例：状态不错）')"
          :aria-label="t('备注')"
          @change="h.note(s.id, $event.target.value.trim())"
        >
      </li>
    </ol>
    <p
      v-else-if="auth.user"
      class="empty"
    >
      {{ t('切换动作后，记录会保存在这台设备的浏览器里，刷新页面也不会丢失。') }}
    </p>
  </section>
</template>
