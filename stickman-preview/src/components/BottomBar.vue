<script setup>
// Bottom row: playback and speed · action picker (two groups) · view presets and orbit.
import { useI18n } from '../i18n/useI18n.js';
import { useEngine } from '../composables/useEngine.js';
import { useSettings, VIEWS } from '../stores/settings.js';
import { ACT } from '../core/actions.js';

const { t } = useI18n();
const { engine, live } = useEngine();
const settings = useSettings();
const groups = [1, 2].map(g => Object.entries(ACT).filter(([, A]) => A.grp === g).map(([k]) => k));

function pickView(v) { settings.view = v; settings.opts.orbit = false; engine.setView(v); }
</script>

<template>
  <footer class="bot">
    <div class="ctl">
      <button
        class="play"
        type="button"
        :disabled="live.camOn"
        @click="engine.setPlaying(!live.playing)"
      >
        {{ t(live.playing ? '暂停' : '播放') }}
      </button>
      <label
        class="spd"
        :class="{ off: live.camOn }"
        for="speed"
      >{{ t('速度') }} <input
        id="speed"
        type="range"
        min="0.5"
        max="2"
        step="0.1"
        :disabled="live.camOn"
        :value="live.speed"
        @input="engine.setSpeed(+$event.target.value)"
      ><output>{{ live.speed.toFixed(1) }}×</output></label>
    </div>
    <nav
      class="dock"
      :aria-label="t('选择动作')"
    >
      <div
        v-for="(g, i) in groups"
        :key="i"
        class="chips"
      >
        <button
          v-for="k in g"
          :key="k"
          type="button"
          class="chip"
          :aria-pressed="String(live.action === k)"
          @click="engine.setAction(k)"
        >
          {{ t(ACT[k].name) }}
        </button>
      </div>
    </nav>
    <div class="ctl r">
      <div
        class="seg"
        role="group"
        :aria-label="t('视角')"
      >
        <button
          v-for="[name, v] in VIEWS"
          :key="name"
          type="button"
          :aria-pressed="String(settings.view === v)"
          @click="pickView(v)"
        >
          {{ t(name) }}
        </button>
      </div>
      <button
        class="tg"
        type="button"
        :aria-pressed="String(settings.opts.orbit)"
        @click="settings.opts.orbit = !settings.opts.orbit"
      >
        {{ t('环绕') }}
      </button>
    </div>
  </footer>
</template>
