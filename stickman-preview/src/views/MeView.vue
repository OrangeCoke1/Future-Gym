<script setup>
// 我的页面 (#/me): the logged-in user's data in one place — totals, training history, profile. Reached from the
// user menu in the top bar; ?s=profile scrolls to the profile. Logged out, it goes back to training.
// A fragment child of AppLayout's .app grid: the page fills the rows below the top bar.
import { ref, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '../i18n/useI18n.js';
import { useAuth } from '../stores/auth.js';
import { useHistory } from '../stores/history.js';
import HistoryLog from '../components/me/HistoryLog.vue';
import ProfileForm from '../components/drawer/ProfileForm.vue';

const { t } = useI18n();
const auth = useAuth(), h = useHistory();
const route = useRoute(), router = useRouter();
const prof = ref(null);
watch(() => auth.ready && !auth.user, out => { if (out) router.replace({ name: 'training' }); }, { immediate: true });
watch(() => route.query.s, s => {
  if (s === 'profile') nextTick(() => prof.value && prof.value.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}, { immediate: true });
</script>

<template>
  <main
    v-if="auth.user"
    class="me"
  >
    <div class="me-h">
      <RouterLink
        class="btn"
        :to="{ name: 'training' }"
      >
        ← {{ t('返回训练') }}
      </RouterLink>
      <h1>{{ t('{0} 的数据', auth.user.username) }}</h1>
    </div>
    <ul class="me-stats">
      <li><b>{{ h.count }}</b>{{ t('训练次数') }}</li>
      <li
        v-for="x in h.totals"
        :key="x.action"
      >
        <b>{{ x.n }}</b>{{ t('{0}（{1}）', t(x.name), t(x.unit)) }}
      </li>
    </ul>
    <div class="me-card">
      <HistoryLog />
    </div>
    <div
      ref="prof"
      class="me-card"
    >
      <ProfileForm />
    </div>
  </main>
</template>
