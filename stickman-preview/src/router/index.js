// Routes. Hash history (#/…) because the static servers (serve.ps1) have no fallback to index.html, so a path URL
// would 404 on reload. Pages are children of AppLayout (the shared shell); add new ones lazily,
// e.g. { path: 'history', name: 'history', component: () => import('../views/HistoryView.vue') }.
// The default page stays a static import so the first screen needs no extra request.
import { createRouter, createWebHashHistory } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';
import TrainingView from '../views/TrainingView.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: AppLayout, children: [{ path: '', name: 'training', component: TrainingView }] },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
