<script setup>
// Panel · about the data: what each provenance label means, and the body model's attribution (CC BY 4.0 requires it).
import { useI18n } from '../../i18n/useI18n.js';

const { t } = useI18n();
const NOTES = [
  ['est', '估算', '按动作强度（MET）或心率公式（Keytel 等，2005）推算，不是测量值。'],
  ['real', '实测', '来自已连接的心率设备；超过 5 秒没有新读数就退回估算。'],
  ['manual', '手动记录', '由你自己输入，只保存在本机浏览器里。'],
  ['sim', '模拟', '2126 概念演示：发力肌群、累计疲劳、恢复预测、关节负荷、血氧、呼吸、核心体温、血乳酸、肌氧、出汗量，以及小人身上的血氧和心跳粒子，都是按动作和运动强度推演的，不是任何传感器的读数。']
];
</script>

<template>
  <section>
    <div class="k">
      {{ t('数据说明') }}
    </div>
    <ul class="legend">
      <li
        v-for="[k, label, text] in NOTES"
        :key="k"
      >
        <span
          class="est"
          :data-k="k"
        >{{ t(label) }}</span><span>{{ t(text) }}</span>
      </li>
      <li>
        <span class="est">{{ t('模型') }}</span><span><span>{{ t('人体模型') }}</span> “Male Body” · Alexander Antipov · <a
          href="https://sketchfab.com/3d-models/male-body-15a422001834483c9750ce6117d59cc1"
          target="_blank"
          rel="noopener"
        >Sketchfab</a> · <a
          href="http://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener"
        >CC BY 4.0</a></span>
      </li>
      <li>
        <span class="est">{{ t('模型') }}</span><span>Xbot · Michelle · <a
          href="https://www.mixamo.com"
          target="_blank"
          rel="noopener"
        >Adobe Mixamo</a></span>
      </li>
      <li>
        <span class="est">{{ t('骨架计算') }}</span><span>{{ t('重心与左右平衡由 3D 骨架的各段位置按人体质量分布算出；演示模式下骨架来自示例动作。') }}</span>
      </li>
    </ul>
    <p class="note">
      {{ t('「演示」播放内置的示例动作；「摄像头」用 MediaPipe Pose 的 3D 关键点驱动小人，并按所选动作的规则计数，画面只在本机处理，不会上传。') }}
    </p>
  </section>
</template>
