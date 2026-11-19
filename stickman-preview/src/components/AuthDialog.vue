<script setup>
// 顶栏 → 登录: log in or register with a username and password (local accounts, stores/auth.js). A native modal
// <dialog>: Esc and the close button close it, focus stays inside while it is open.
import { ref, watch, nextTick } from 'vue';
import { useI18n } from '../i18n/useI18n.js';
import { useAuth } from '../stores/auth.js';
import { NAME_MAX, PASS_MIN } from '../db/users.js';

const open = defineModel('open', { type: Boolean, required: true });
const { t } = useI18n();
const auth = useAuth();
const dlg = ref(null), nameIn = ref(null);
const mode = ref('login');                               // 'login' | 'register'
const name = ref(''), pass = ref(''), err = ref(''), busy = ref(false);

watch(open, v => {
  if (v) { err.value = ''; pass.value = ''; dlg.value.showModal(); nextTick(() => nameIn.value && nameIn.value.focus()); }
  else if (dlg.value.open) dlg.value.close();
});
watch(mode, () => { err.value = ''; });

async function submit() {
  if (busy.value) return;
  busy.value = true; err.value = '';
  try {
    await (mode.value === 'login' ? auth.login : auth.register)(name.value, pass.value);
    open.value = false;
  } catch (e) {
    // our own messages are Chinese source text; anything else (database blocked) gets a generic one
    err.value = /[一-鿿]/.test(e.message) ? e.message : '这个浏览器无法使用本地数据库，训练历史不会保存。';
  } finally { busy.value = false; }
}
</script>

<template>
  <dialog
    ref="dlg"
    class="auth"
    :aria-label="t('登录')"
    @close="open = false"
  >
    <form @submit.prevent="submit">
      <div
        class="seg"
        role="group"
      >
        <button
          v-for="[m, label] in [['login', '登录'], ['register', '注册']]"
          :key="m"
          type="button"
          :aria-pressed="String(mode === m)"
          @click="mode = m"
        >
          {{ t(label) }}
        </button>
      </div>
      <label>{{ t('用户名') }}<input
        ref="nameIn"
        v-model="name"
        type="text"
        autocomplete="username"
        :maxlength="NAME_MAX"
        required
      ></label>
      <label>{{ t('密码') }}<input
        v-model="pass"
        type="password"
        :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
        :minlength="mode === 'register' ? PASS_MIN : undefined"
        required
      ></label>
      <p
        class="err"
        role="alert"
      >
        {{ err ? t(err) : '' }}
      </p>
      <p
        v-if="mode === 'register'"
        class="note"
      >
        {{ t('账户只保存在这台设备的浏览器里。新账户会沿用当前的个人资料。') }}
      </p>
      <div class="row">
        <button
          class="drink"
          type="submit"
          :disabled="busy"
        >
          {{ mode === 'login' ? t('登录') : t('注册并登录') }}
        </button>
        <button
          class="btn"
          type="button"
          @click="open = false"
        >
          {{ t('关闭') }}
        </button>
      </div>
    </form>
  </dialog>
</template>
