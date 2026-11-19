// Hash history keeps static-server deep links working. The lobby is standalone and training loads on demand.
import { createRouter, createWebHashHistory } from 'vue-router';
import LobbyView from '../views/LobbyView.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'lobby', component: LobbyView },
    {
      path: '/training',
      component: () => import('../layouts/AppLayout.vue'),
      children: [{ path: '', name: 'training', component: () => import('../views/TrainingView.vue') }],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
