<script setup>
// Panel · profile: weight, age and sex, used only for the energy estimate. Out-of-range input is ignored and the
// field shows the kept value again on blur.
import { useI18n } from '../../i18n/useI18n.js';
import { useProfile, LIMITS } from '../../stores/profile.js';

const { t } = useI18n();
const store = useProfile();
const p = store.profile;
const FIELDS = [['w', '体重', 'kg'], ['age', '年龄', '岁']];
const restore = (e, key) => { e.target.value = p[key]; };
</script>

<template>
  <section>
    <div class="k">
      {{ t('个人资料') }}
    </div>
    <div
      class="prof"
      role="group"
      :aria-label="t('用于估算的个人资料')"
    >
      <label
        v-for="[key, name, unit] in FIELDS"
        :key="key"
      >{{ t(name) }}<input
        type="number"
        :min="LIMITS[key][0]"
        :max="LIMITS[key][1]"
        step="1"
        inputmode="numeric"
        :value="p[key]"
        @input="store.setNum(key, +$event.target.value)"
        @blur="restore($event, key)"
      >{{ t(unit) }}</label>
      <div
        class="seg"
        role="group"
        :aria-label="t('性别')"
      >
        <button
          v-for="[s, name] in [['m', '男'], ['f', '女']]"
          :key="s"
          type="button"
          :aria-pressed="String(p.sex === s)"
          @click="store.setSex(s)"
        >
          {{ t(name) }}
        </button>
      </div>
    </div>
    <p class="note">
      {{ t('只用于估算能量消耗。') }}
    </p>
  </section>
</template>
