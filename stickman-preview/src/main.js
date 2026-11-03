import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { i18n } from './i18n/index.js';
import { router } from './router/index.js';
import './styles/index.css';

const app = createApp(App).use(createPinia()).use(i18n).use(router);
// the first navigation resolves asynchronously; mount once the page is known so it renders in the first pass
router.isReady().then(() => app.mount('#app'));
