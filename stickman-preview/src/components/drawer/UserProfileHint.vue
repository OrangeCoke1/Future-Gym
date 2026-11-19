<script setup>
// Panel · profile while logged in: the profile belongs to the account, so it is edited on 我的页面.
import { useI18n } from '../../i18n/useI18n.js';
import { useAuth } from '../../stores/auth.js';

const { t } = useI18n();
const auth = useAuth();
</script>

<template>
  <section>
    <div class="k">
      {{ t('个人资料') }}
    </div>
    <p class="note">
      {{ t('已登录：个人资料保存在账户里，请在「{0} ▾ → 个人资料」修改。', auth.user.username) }}
    </p>
  </section>
</template>
