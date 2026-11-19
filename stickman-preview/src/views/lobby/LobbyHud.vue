<script setup>
import { useI18n } from '../../i18n/useI18n.js';
import { ACT } from '../../core/actions.js';
import { STATIONS } from '../../lobby/stations.js';

defineProps({
  fallback: { type: Boolean, required: true },
  active: { type: String, default: null },
});
const emit = defineEmits({
  pick: station => STATIONS.includes(station),
  highlight: id => id === null || STATIONS.some(s => s.id === id),
});
const { t, lang } = useI18n();
const languages = [['zh', 'zh-CN', '中文'], ['ja', 'ja', '日本語'], ['en', 'en', 'EN']];

const labels = new Map();
function setLabel(id, el) {
  if (el) labels.set(id, el);
  else labels.delete(id);
}

function positionLabels(positions) {
  for (const { id, x, y, visible } of positions) {
    const el = labels.get(id);
    if (!el) continue;
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    el.style.visibility = visible ? 'visible' : 'hidden';
  }
}
defineExpose({ positionLabels });
</script>

<template>
  <div class="lobby-hud">
    <header class="lobby-header">
      <div class="lobby-title">
        <h1>{{ t('未来健身 2126') }}</h1>
        <p lang="en">
          CAPSULE GYM
        </p>
      </div>
      <div
        class="seg lobby-lang"
        role="group"
        :aria-label="t('语言')"
      >
        <button
          v-for="[id, locale, label] in languages"
          :key="id"
          type="button"
          :lang="locale"
          :aria-pressed="lang === id"
          @click="lang = id"
        >
          {{ label }}
        </button>
      </div>
    </header>
    <div
      v-if="fallback"
      class="lobby-capsule"
      aria-hidden="true"
    >
      <i /><i />
    </div>
    <div
      v-for="station in STATIONS"
      v-show="station.id === active && !fallback"
      :key="station.id"
      :ref="el => setLabel(station.id, el)"
      class="lobby-label"
      aria-hidden="true"
    >
      <div>
        <strong>{{ t(station.name) }}</strong>
        <span>{{ station.acts.map(key => t(ACT[key].name)).join(' · ') }}</span>
      </div>
    </div>
    <footer class="lobby-footer">
      <p>{{ t(fallback ? '选择器械开始训练' : '拖动查看 · 点击器械开始训练') }}</p>
      <div
        class="lobby-stations"
        role="group"
        :aria-label="t('健身舱')"
      >
        <button
          v-for="station in STATIONS"
          :key="station.id"
          type="button"
          :aria-label="`${t(station.name)} · ${t('进入训练')}: ${t(ACT[station.act].name)}`"
          :class="{ 'is-active': station.id === active }"
          @click="emit('pick', station)"
          @focus="emit('highlight', station.id)"
          @blur="emit('highlight', null)"
          @pointerenter="emit('highlight', station.id)"
          @pointerleave="emit('highlight', null)"
        >
          <strong>{{ t(station.name) }}</strong>
          <span>{{ t(ACT[station.act].name) }}</span>
        </button>
      </div>
    </footer>
  </div>
</template>
