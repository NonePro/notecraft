import fuzzysort from 'fuzzysort';
import marked from 'marked';
import Vue from 'vue';
import VueAutosuggest from 'vue-autosuggest';
import { Component } from 'vue-property-decorator';
import { mapGetters, mapState } from 'vuex';
import { TheTask } from '../../src/TheTask';
import { IExtensionConfig } from '../../src/types';
import { updateFilterValueMutation, vscodeApi } from './store';
import TaskComponent from './Task.vue';

marked.Renderer.prototype.paragraph = text => `${text}`;

Vue.use(VueAutosuggest);
Vue.component('task', TaskComponent);// needs to be global for recursive rendering

@Component({
	computed: {
		...mapState(['tasks', 'filterInputValue', 'config', 'defaultFileSpecified', 'activeDocumentOpened']),
		...mapGetters(['filteredSortedTasks', 'autocompleteItems']),
	},
})
export default class App extends Vue {
	tasks!: TheTask[];
	filteredSortedTasks!: TheTask[];
	filterInputValue!: string;
	config!: IExtensionConfig['webview'];
	defaultFileSpecified!: boolean;
	activeDocumentOpened!: boolean;
	autocompleteItems!: any;

	filteredSuggestions = [];

	$refs!: {
		filterInput: HTMLInputElement;
	};
	// ──────────────────────────────────────────────────────────────────────
	fuzzyHighlight(value: string) {
		return fuzzysort.highlight(fuzzysort.single(this.filterInputValue, value), '<mark>', '</mark>');
	}
	onFilterInputChange(value: string) {
		updateFilterValueMutation(value);
		this.filteredSuggestions = [{
			data: fuzzysort.go(value, this.autocompleteItems[0].data).map(item => item.target),
		}];
		this.updateWebviewCounter(this.filteredSortedTasks.length);
	}
	onSelect(e: { item: string }) {
		this.onFilterInputChange(e.item);
	}
	updateWebviewCounter(numberOfTasks: number) {
		vscodeApi.postMessage({
			type: 'updateTitle',
			value: String(numberOfTasks),
		});
	}
	showNotification(text: string) {
		vscodeApi.postMessage({
			type: 'showNotification',
			value: text,
		});
	}
	// ──────────────────────────────────────────────────────────────────────
	mounted() {
		Vue.nextTick(() => {
			const suggest = document.getElementById('autosuggest__input');
			suggest.focus();
		});
	}
}
