<script setup>
// Top bar, logged in: the username opens a menu with everything that belongs to the user — a one-line summary,
// 训练记录 / 个人资料 (both on 我的页面 #/me) and 退出登录. Esc or a click outside closes it.
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '../i18n/useI18n.js';
import { useAuth } from '../stores/auth.js';
import { useHistory } from '../stores/history.js';

const { t } = useI18n();
const auth = useAuth(), h = useHistory();
const router = useRouter();
const open = ref(false), root = ref(null), btn = ref(null);

function go(s) { open.value = false; router.push({ name: 'me', query: s ? { s } : {} }); }
function logout() { open.value = false; auth.logout(); router.push('/'); }
const onDown = e => { if (open.value && root.value && !root.value.contains(e.target)) open.value = false; };
const onKey = e => { if (e.key === 'Escape' && open.value) { open.value = false; btn.value && btn.value.focus(); } };
onMounted(() => { addEventListener('pointerdown', onDown); addEventListener('keydown', onKey); });
onBeforeUnmount(() => { removeEventListener('pointerdown', onDown); removeEventListener('keydown', onKey); });
</script>

<template>
  <div
    ref="root"
    class="umenu"
  >
    <button
      ref="btn"
      class="btn"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="String(open)"
      @click="open = !open"
    >
      {{ auth.user.username }} ▾
    </button>
    <div
      v-if="open"
      class="umenu-list"
      role="menu"
    >
      <p class="umenu-sum">
        {{ t('训练 {0} 次', h.count) }}
      </p>
      <button
        type="button"
        role="menuitem"
        @click="go()"
      >
        {{ t('训练记录') }}
      </button>
      <button
        type="button"
        role="menuitem"
        @click="go('profile')"
      >
        {{ t('个人资料') }}
      </button>
      <button
        type="button"
        role="menuitem"
        @click="logout"
      >
        {{ t('退出登录') }}
      </button>
    </div>
  </div>
</template>
