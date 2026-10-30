<script setup>
// Slide-over panel for the secondary controls. Esc or the scrim closes it; focus moves to the close button on open
// and back to the panel button (handled by App) on close.
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import DisplayOptions from './DisplayOptions.vue';
import ProfileForm from './ProfileForm.vue';
import SessionLog from './SessionLog.vue';
import DataNotes from './DataNotes.vue';

const open = defineModel('open', { type: Boolean, required: true });
const { t } = useI18n();
const closeBtn = ref(null);
watch(open, v => { if (v) nextTick(() => closeBtn.value && closeBtn.value.focus()); });
const onKey = e => { if (e.key === 'Escape' && open.value) open.value = false; };
onMounted(() => addEventListener('keydown', onKey));
onBeforeUnmount(() => removeEventListener('keydown', onKey));
</script>

<template>
  <div
    class="scrim"
    :class="{ open }"
    @click="open = false"
  />
  <aside
    id="drawer"
    class="drawer"
    :class="{ open }"
    :aria-label="t('面板')"
    :inert="!open"
  >
    <div class="dr-h">
      <span>{{ t('面板') }}</span>
      <button
        ref="closeBtn"
        class="btn"
        type="button"
        @click="open = false"
      >
        {{ t('关闭') }}
      </button>
    </div>
    <div class="dr-b">
      <DisplayOptions />
      <ProfileForm />
      <SessionLog />
      <DataNotes />
    </div>
  </aside>
</template>
