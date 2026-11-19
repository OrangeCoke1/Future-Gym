// Hash history keeps static-server deep links working. The lobby is standalone and training loads on demand.
import { createRouter, createWebHashHistory } from 'vue-router';
import LobbyView from '../views/LobbyView.vue';

const AppLayout = () => import('../layouts/AppLayout.vue');   // shared shell of the training page and 我的页面

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'lobby', component: LobbyView },
    {
      path: '/training',
      component: AppLayout,
      children: [{ path: '', name: 'training', component: () => import('../views/TrainingView.vue') }],
    },
    {
      path: '/me',
      component: AppLayout,
      children: [{ path: '', name: 'me', component: () => import('../views/MeView.vue') }],   // 我的页面: the user's records and profile
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
