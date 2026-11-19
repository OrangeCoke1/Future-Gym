<script setup>
import { useI18n } from '../../i18n/useI18n.js';
import { ACT } from '../../core/actions.js';
import { STATIONS } from '../../lobby/stations.js';

const emit = defineEmits({ pick: station => STATIONS.includes(station) });
const { t, lang } = useI18n();
const languages = [['zh', 'zh-CN', '中文'], ['ja', 'ja', '日本語'], ['en', 'en', 'EN']];
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
      class="lobby-capsule"
      aria-hidden="true"
    >
      <i /><i />
    </div>
    <footer class="lobby-footer">
      <p>{{ t('选择器械开始训练') }}</p>
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
          @click="emit('pick', station)"
        >
          <strong>{{ t(station.name) }}</strong>
          <span>{{ t(ACT[station.act].name) }}</span>
        </button>
      </div>
    </footer>
  </div>
</template>
