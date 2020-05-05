import { TheTask } from './parse';
import { DueState } from './types';

export function filterItems(tasks: TheTask[], filterStr: string): TheTask[] {
	if (filterStr.length === 0) {
		return tasks;
	}
	const filters = parseFilter(filterStr);
	const filteredTasks = tasks.filter(task => {
		const results = [];
		for (const filter of filters) {
			let filterResult;
			if (filter.filterType === FilterType.tagEqual) {
				// #Tag
				if (task.tags.includes(filter.value)) {
					filterResult = true;
				} else {
					filterResult = false;
				}
			} else if (filter.filterType === FilterType.contextEqual) {
				// @Context
				if (task.contexts.includes(filter.value)) {
					filterResult = true;
				} else {
					filterResult = false;
				}
			} else if (filter.filterType === FilterType.projectEqual) {
				// +Project
				if (task.projects.includes(filter.value)) {
					filterResult = true;
				} else {
					filterResult = false;
				}
			} else if (filter.filterType === FilterType.done) {
				// $done
				if (task.done) {
					filterResult = true;
				} else {
					filterResult = false;
				}
			} else if (filter.filterType === FilterType.due) {
				// $due
				if (task.isDue === DueState.due || task.isDue === DueState.overdue) {
					filterResult = true;
				} else {
					filterResult = false;
				}
			} else if (filter.filterType === FilterType.overdue) {
				// $overdue
				if (task.isDue === DueState.overdue) {
					filterResult = true;
				} else {
					filterResult = false;
				}
			} else if (filter.filterType === FilterType.recurring) {
				// $recurring
				if (task.isRecurring === true) {
					filterResult = true;
				} else {
					filterResult = false;
				}
			}
			if (filter.isNegation) {
				filterResult = !filterResult;
			}
			results.push(filterResult);
		}
		return results.every(r => r === true);
	});
	return filteredTasks;
}
const enum FilterType {
	tagEqual,
	contextEqual,
	projectEqual,
	due,
	overdue,
	recurring,
	done,
}
interface Filter {
	value: string;
	filterType: FilterType;
	isNegation?: boolean;
}

function parseFilter(filterStr: string) {
	const words = filterStr.split(' ');
	const filters: Filter[] = [];
	for (const word of words) {
		const filter: Filter = {
			isNegation: false,
			value: '',
			filterType: FilterType.tagEqual, // TODO: default to text
		};
		let isNegation;
		let value;
		let firstChar;
		let filterType;
		if (word[0] === '-') {
			isNegation = true;
			value = word.slice(2);
			firstChar = word[1];
		} else {
			value = word.slice(1);
			firstChar = word[0];
		}
		switch (firstChar) {
			case '#': {
				filterType = FilterType.tagEqual; break;
			}
			case '@': {
				filterType = FilterType.contextEqual; break;
			}
			case '+': {
				filterType = FilterType.projectEqual; break;
			}
			case '$': {
				if (value === 'done') {
					filterType = FilterType.done;
				} else if (value === 'due') {
					filterType = FilterType.due;
				} else if (value === 'overdue') {
					filterType = FilterType.overdue;
				} else if (value === 'recurring') {
					filterType = FilterType.recurring;
				}
				break;
			}
			default: {
				filterType = FilterType.tagEqual;
			}
		}
		filter.isNegation = isNegation;
		// @ts-ignore
		filter.filterType = filterType;
		filters.push(filter);
	}
	return filters;
}

