import Vue from 'vue';
import App from './app/App.vue';
import { store } from './app/store';

Vue.config.productionTip = false;
Vue.config.devtools = false;

const app = new Vue({
	store,
	render: h => h(App),
}).$mount('#app');

type NotificationType = 'error' | 'info' | 'success' | 'warn';

/**
 * Show toast notification
 */
export function showToastNotification(text: string, {
	type = 'info',
}: {
	type?: NotificationType;
} = {}) {
	app.$notify({
		text,
		type,
	});
}
