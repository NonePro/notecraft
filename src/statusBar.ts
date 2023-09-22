import { MarkdownString, StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { Constants } from './constants';
import { $config } from './extension';
import { TheTask } from './TheTask';
import { formatTask } from './utils/taskUtils';
import { percentage } from './utils/utils';
import { getTaskHoverMd } from './languageFeatures/getTaskHover';

abstract class StatusBar {
	protected statusBarItem!: StatusBarItem;

	abstract show(): void;
	abstract update(...args: any[]): void;

	hide(): void {
		this.statusBarItem.hide();
	}

	protected updateText(text: string): void {
		this.statusBarItem.text = text;
	}

	protected updateHover(text: MarkdownString | string): void {
		this.statusBarItem.tooltip = text;
	}
}


export class CounterStatusBar extends StatusBar {
	constructor() {
		super();
		this.statusBarItem = window.createStatusBarItem(`Todo MD: Counter`, StatusBarAlignment.Left, -20000);
		this.statusBarItem.name = `Todo MD: Counter`;
	}

	show() {
		if ($config.statusBarCounterEnabled) {
			this.statusBarItem.show();
		} else {
			this.statusBarItem.hide();
		}
	}

	/**
	 * @param tasks All tasks that percentage should be calculated from.
	 */
	update(tasks: TheTask[]) {
		const completedTasks = tasks.filter(t => t.done);
		this.statusBarItem.text = showCompletedPercentage(tasks.length, completedTasks.length);
	}
}

export class MainStatusBar extends StatusBar {
	constructor() {
		super();
		this.statusBarItem = window.createStatusBarItem(`${Constants.ExtensionMenuPrefix} Main`, StatusBarAlignment.Left, -20001);
		this.statusBarItem.name = `${Constants.ExtensionMenuPrefix} Main`;
		this.show();
	}

	show() {
		if ($config.statusBarMainEnabled) {
			this.statusBarItem.show();
		} else {
			this.statusBarItem.hide();
		}
	}

	update(fewNextTasks: TheTask[]) {
		if (!$config.statusBarMainEnabled) {
			return;
		}
		this.updateText(fewNextTasks.length ? formatTask(fewNextTasks[0]) : '');
		this.updateHover(getTaskHoverMd(fewNextTasks.slice(0, $config.getNextNumberOfTasks)));
	}
}

export function showCompletedPercentage(tasksCount: number, completedTasksCount: number): string {
	const percentageString = percentage(completedTasksCount, tasksCount).toFixed(1);
	return `${completedTasksCount}/${tasksCount} (${percentageString}%)`;
}
