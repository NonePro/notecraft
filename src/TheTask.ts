import type { Range } from 'vscode';
import { DueDate } from './dueDate';
import { DueState, OptionalExceptFor } from './types';
/**
 * All possible values for task priority
 */
export type Priority = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L'|'M'|'N'|'O'|'P'|'Q'|'R'|'S'|'T'|'U'|'V'|'W'|'X'|'Y'|'Z';
/**
 * Task can be create with just a few required properties.
 */
export type TaskInit = OptionalExceptFor<TheTask, 'indentLvl' | 'lineNumber' | 'rawText' | 'title'>;
/**
 * Modifier for task completion.
 * Instead of completing the task increases count by 1.
 * When the number matches the goal - the task is considered completed.
 */
export interface Count {
	range: Range;
	needed: number;
	current: number;
}
/**
 * Parsed link
 */
export interface Link {
	value: string;
	scheme: string;
	characterRange: [number, number];
}
/**
 * `The` prefix because of auto import conflict with vscode `Task`
 */
export class TheTask {
	/**
	 * rawText without indent
	 */
	title: string;
	/**
	 * If task is completed or not
	 */
	done: boolean;
	/**
	 * Unmodified task text
	 */
	rawText: string;
	/**
	 * Line number of the task. Also might be an id, since 1 line - 1 task
	 */
	lineNumber: number;
	/**
	 * How much the task is nested.
	 */
	indentLvl: number;
	/**
	 * Indent (spaces or tabs) saved as string.
	 */
	indent?: string;
	/**
	 * Parent task line number (id) task is non-root.
	 */
	parentTaskLineNumber: number | undefined;
	/**
	 * Nested tasks that this task is a parent of (if they exist)
	 */
	subtasks: TheTask[];
	/**
	 * Tags as an array of strings
	 */
	tags: string[];
	/**
	 * Projects as an array of strings
	 */
	projects: string[];
	/**
	 * Contexts as an array of strings
	 */
	contexts: string[];
	/**
	 * Due date if exists
	 */
	due?: DueDate;
	/**
	 * Completion date as string (can contain time).
	 */
	completionDate?: string;
	/**
	 * Creation date as string (can contain time).
	 */
	creationDate?: string;
	/**
	 * Parsed links in the task
	 */
	links: Link[];
	/**
	 * Special tag `{count:1/2}`. Used for tasks that require multiple iterations.
	 */
	count?: Count;
	/**
	 * Priority `(A)`
	 */
	priority: Priority;
	/**
	 * Special tag `{h}`. Used for hiding items from Tree View.
	 */
	isHidden?: boolean;
	/**
	 * Special tag `{c}`. Used for webview and Tree View to store state of nested tasks.
	 */
	isCollapsed?: boolean;
	/**
	 * Special tag `{overdue:2020-05-05}` Oldest overdue date string in `YYYY-MM-DD` (for recurring tasks)
	 */
	overdue?: string;
	/**
	 * Tracking of task time. Defines when the task was manually started by user. Date as string.
	 */
	start?: string;
	/**
	 * Time tracking of task. Duration as string.
	 */
	duration?: string;
	/**
	 * Context ranges needed for editor decorations
	 */
	contextRanges: Range[];
	/**
	 * Project ranges needed for editor decorations
	 */
	projectRanges: Range[];
	/**
	 * Special tags ranges `{}` needed for editor decorations
	 */
	specialTagRanges: Range[];
	/**
	 * Priority range needed for editor decorations
	 */
	priorityRange?: Range;
	/**
	 * Tags delimiter ranges `#` sign needed for editor decorations
	 */
	tagsDelimiterRanges?: Range[];
	/**
	 * Tags ranges needed for editor decorations
	 */
	tagsRange?: Range[];
	/**
	 * Due date range needed for editor decorations
	 */
	dueRange?: Range;
	/**
	 * Overdue special tag range needed for editor decorations
	 */
	overdueRange?: Range;
	/**
	 * Start range.
	 */
	startRange?: Range;
	/**
	 * Duration range.
	 */
	durationRange?: Range;
	/**
	 * Completion special tag
	 */
	completionDateRange?: Range;
	/**
	 * Collapse special tag range `{c}`
	 */
	collapseRange?: Range;

	constructor(init: TaskInit) {
		this.title = init.title;
		this.lineNumber = init.lineNumber;
		this.indentLvl = init.indentLvl;
		this.subtasks = init.subtasks ?? [];
		this.rawText = init.rawText;
		this.done = init.done ?? false;
		this.tags = init.tags ?? [];
		this.projects = init.projects ?? [];
		this.priority = init.priority ?? TheTask.defaultTaskPriority;
		this.completionDate = init.completionDate;
		this.creationDate = init.creationDate;
		this.indent = init.indent;
		this.links = init.links ?? [];
		this.due = init.due;
		this.start = init.start;
		this.startRange = init.startRange;
		this.dueRange = init.dueRange;
		this.duration = init.duration;
		this.durationRange = init.durationRange;
		this.count = init.count;
		this.isHidden = init.isHidden;
		this.isCollapsed = init.isCollapsed;
		/**
		 * Oldest overdue date string in `YYYY-MM-DD` (for recurring tasks)
		 */
		this.overdue = init.overdue;
		this.parentTaskLineNumber = init.parentTaskLineNumber;
		this.contexts = init.contexts ?? [];
		this.specialTagRanges = init.specialTagRanges ?? [];
		this.contextRanges = init.contextRanges ?? [];
		this.projectRanges = init.projectRanges ?? [];
		this.priorityRange = init.priorityRange;
		this.tagsDelimiterRanges = init.tagsDelimiterRanges;
		this.tagsRange = init.tagsRange;
		this.overdueRange = init.overdueRange;
		this.collapseRange = init.collapseRange;
		this.completionDateRange = init.completionDateRange;
	}
	/**
	 * Gets all nested task line numbers (recursive)
	 */
	static getNestedTasksLineNumbers(tasks: TheTask[]): number[] {
		const ids = [];
		for (const task of tasks) {
			ids.push(task.lineNumber);
			if (task.subtasks) {
				ids.push(...TheTask.getNestedTasksLineNumbers(task.subtasks));
			}
		}
		return ids;
	}

	// static isRoot(task: TheTask) {
	// 	return task.parentTaskLineNumber === undefined;
	// }

	static hasNestedTasks(task: TheTask) {
		return task.subtasks.length !== 0;
	}
	/**
	 * Format task title for notification or modal dialog
	 */
	static formatTask(task: TheTask, {
		ignoreDueDate = false,
	}: {
		ignoreDueDate?: boolean;
	} = {}): string {
		let result = '';
		if (!ignoreDueDate) {
			if (task.due?.isDue === DueState.due) {
				result += '🟩 ';
			} else if (task.due?.isDue === DueState.overdue) {
				result += '🟥 ';
			} else if (task.due?.isDue === DueState.invalid) {
				result += '🟪 ';
			}
		}
		result += task.title;
		if (task.count) {
			result += ` ${task.count.current}/${task.count.needed}`;
		}
		return result;
	}
	static defaultTaskPriority: Priority = 'G';
}
