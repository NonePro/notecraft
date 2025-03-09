import { $config } from '../extension';
import { updateSetting } from '../utils/vscodeUtils';

export function webviewToggleShowRecurringUpcoming() {
	updateSetting('notecraft.webview.showRecurringUpcoming', !$config.webview.showRecurringUpcoming);
}
