import { TheTask } from './parse';

const enum SortDirection {
	DESC,
	ASC
}
export const enum SortProperty {
	priority,
}

export function sortTasks(tasks: TheTask[], property: SortProperty, direction = SortDirection.DESC): TheTask[] {
	const tasksCopy = tasks.slice();
	let sortedTasks: TheTask[] = [];

	if (property === SortProperty.priority) {
		sortedTasks = tasksCopy.sort((a, b) => a.priority > b.priority ? 1 : -1);
	}
	if (direction === SortDirection.ASC) {
		return sortedTasks.reverse();
	}
	return sortedTasks;
}
