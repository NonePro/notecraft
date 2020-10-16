import dayjs from 'dayjs';
import * as fs from 'fs';
import vscode, { commands, Range, TextLine, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import { appendTaskToFile, archiveTask, deleteTask, getActiveDocument, hideTask, incrementCountForTask, incrementOrDecrementPriority, resetAllRecurringTasks, toggleDoneAtLine, toggleDoneOrIncrementCount } from './documentActions';
import { DueDate } from './dueDate';
import { extensionConfig, LAST_VISIT_STORAGE_KEY, state, updateState } from './extension';
import { parseDocument } from './parse';
import { defaultSortTasks, SortProperty, sortTasks } from './sort';
import { Count, TheTask } from './TheTask';
import { getDateInISOFormat } from './timeUtils';
import { TaskTreeItem } from './treeViewProviders/taskProvider';
import { updateAllTreeViews, updateArchivedTasksTreeView, updateTasksTreeView } from './treeViewProviders/treeViews';
import { VscodeContext } from './types';
import { fancyNumber, getRandomInt } from './utils';
import { followLink, getFullRangeFromLines, inputOffset, openFileInEditor, openSettingGuiAt, setContext } from './vscodeUtils';

class QuickPickItem implements vscode.QuickPickItem {
	label: string;
	description?: string;

	constructor(label: string, description?: string) {
		this.label = label;
		this.description = description;
	}
}

export function registerAllCommands() {
	commands.registerCommand('todomd.toggleDone', async (treeItem?: TaskTreeItem) => {
		const editor = window.activeTextEditor;
		let document: vscode.TextDocument;
		let lineNumber: number;
		if (treeItem) {
			lineNumber = treeItem.task.lineNumber;
			document = getActiveDocument();
		} else {
			if (!editor) {
				return;
			}
			lineNumber = editor.selection.active.line;
			document = editor.document;
		}

		await toggleDoneOrIncrementCount(document, lineNumber);

		await updateState();
		updateAllTreeViews();
	});
	commands.registerCommand('todomd.hideTask', async (treeItem?: TaskTreeItem) => {
		if (!treeItem) {
			return;
		}
		const lineNumber = treeItem.task.lineNumber;
		const document = getActiveDocument();

		hideTask(document, lineNumber);

		await updateState();
		updateAllTreeViews();
	});
	commands.registerCommand('todomd.deleteTask', async (treeItem?: TaskTreeItem) => {
		if (!treeItem) {
			return;
		}
		const lineNumber = treeItem.task.lineNumber;
		const document = getActiveDocument();

		deleteTask(document, lineNumber);

		await updateState();
		updateAllTreeViews();
	});
	commands.registerTextEditorCommand('todomd.archiveCompletedTasks', editor => {
		if (!extensionConfig.defaultArchiveFile) {
			noArchiveFileMessage();
			return;
		}
		const completedTasks = state.tasks.filter(t => t.done);
		if (!completedTasks.length) {
			return;
		}
		const wEdit = new WorkspaceEdit();
		for (const task of completedTasks) {
			const line = editor.document.lineAt(task.lineNumber);
			archiveTask(wEdit, editor.document.uri, line, !task.due?.isRecurring);
		}
		applyEdit(wEdit, editor.document);
	});
	commands.registerTextEditorCommand('todomd.archiveSelectedCompletedTasks', editor => {
		if (!extensionConfig.defaultArchiveFile) {
			noArchiveFileMessage();
			return;
		}
		const selection = editor.selection;
		const wEdit = new WorkspaceEdit();

		for (let i = selection.start.line; i <= selection.end.line; i++) {
			const task = getTaskAtLine(i);
			if (!task || !task.done) {
				continue;
			}
			const line = editor.document.lineAt(i);
			archiveTask(wEdit, editor.document.uri, line, !task.due?.isRecurring);
		}
		applyEdit(wEdit, editor.document);
	});
	commands.registerTextEditorCommand('todomd.sortByPriority', (editor, edit) => {
		const selection = editor.selection;
		if (selection.isEmpty) {
			vscode.window.showInformationMessage('Select tasks to sort');
			return;
		}
		const lineStart = selection.start.line;
		const lineEnd = selection.end.line;
		const tasks: TheTask[] = [];
		for (let i = lineStart; i <= lineEnd; i++) {
			const task = getTaskAtLine(i);
			if (task) {
				tasks.push(task);
			}
		}
		const sortedTasks = sortTasks(tasks, SortProperty.priority);
		const result = sortedTasks.map(t => t.rawText).join('\n');
		edit.replace(getFullRangeFromLines(editor.document, lineStart, lineEnd), result);
	});
	commands.registerTextEditorCommand('todomd.createSimilarTask', async editor => {
		// Create a task with all the tags, projects and contexts of another task
		const selection = editor.selection;
		const task = getTaskAtLine(selection.start.line);
		if (!task) {
			return;
		}
		const line = editor.document.lineAt(task.lineNumber);
		const wEdit = new WorkspaceEdit();

		const tagsAsString = task.tags.map(tag => ` #${tag}`).join('');
		const projectsAsString = task.projects.map(project => `+${project}`).join(' ');
		const contextsAsString = task.contexts.map(context => `@${context}`).join(' ');
		let newTaskAsString = tagsAsString;
		newTaskAsString += projectsAsString ? ` ${projectsAsString}` : '';
		newTaskAsString += contextsAsString ? ` ${contextsAsString}` : '';
		wEdit.insert(editor.document.uri, new vscode.Position(line.rangeIncludingLineBreak.end.line, line.rangeIncludingLineBreak.end.character), `${newTaskAsString}\n`);

		await applyEdit(wEdit, editor.document);

		editor.selection = new vscode.Selection(line.lineNumber + 1, 0, line.lineNumber + 1, 0);
	});
	commands.registerCommand('todomd.getNextTask', async () => {
		await updateState();
		const tasks = state.tasks.filter(t => !t.done);
		if (!tasks.length) {
			vscode.window.showInformationMessage('No tasks');
			return;
		}
		const sortedTasks = defaultSortTasks(tasks);
		const task = sortedTasks[0];

		if (task.links.length) {
			const buttonName = 'Follow link';
			const shouldFollow = await vscode.window.showInformationMessage(TheTask.formatTask(task), buttonName);
			if (shouldFollow === buttonName) {
				followLink(task.links[0].value);
			}
		} else {
			vscode.window.showInformationMessage(TheTask.formatTask(task));
		}
	});
	commands.registerCommand('todomd.getFewNextTasks', async () => {
		await updateState();
		const tasks = state.tasks.filter(t => !t.done);
		if (!tasks.length) {
			vscode.window.showInformationMessage('No tasks');
			return;
		}
		const sortedTasks = defaultSortTasks(tasks)
			.slice(0, extensionConfig.getNextNumberOfTasks);

		vscode.window.showInformationMessage(sortedTasks.map((task, i) => `${fancyNumber(i + 1)} ${TheTask.formatTask(task)}`).join('\n'), {
			modal: true,
		});
	});
	commands.registerCommand('todomd.getRandomTask', async () => {
		await updateState();
		let tasks = state.tasks.filter(t => !t.done);
		if (!tasks.length) {
			vscode.window.showInformationMessage('No tasks');
			return;
		}
		const dueTasks = tasks.filter(t => t.due?.isDue);
		let resultTask;
		if (dueTasks.length) {
			resultTask = dueTasks[getRandomInt(0, dueTasks.length - 1)];
		} else {
			tasks = tasks.filter(t => !t.due);
			resultTask = tasks[getRandomInt(0, tasks.length - 1)];
		}
		vscode.window.showInformationMessage(TheTask.formatTask(resultTask));
	});
	commands.registerCommand('todomd.addTaskToDefaultFile', async () => {
		const creationDate = extensionConfig.addCreationDate ? `{cr:${getDateInISOFormat(new Date(), extensionConfig.creationDateIncludeTime)}} ` : '';
		const isDefaultFileSpecified = await checkDefaultFileAndNotify();
		if (!isDefaultFileSpecified) {
			return;
		}
		const text = await window.showInputBox({
			prompt: 'Add a task to default file',
		});
		if (!text) {
			return;
		}
		await appendTaskToFile(creationDate + text, extensionConfig.defaultFile);
		await updateState();
		updateAllTreeViews();
	});
	commands.registerTextEditorCommand('todomd.setDueDate', editor => {
		const line = editor.selection.active.line;
		const task = getTaskAtLine(line);
		const inputBox = window.createInputBox();
		let value: string | undefined = '+0';
		inputBox.value = value;
		inputBox.prompt = DueDate.helpCreateDueDate(value);
		inputBox.show();

		inputBox.onDidChangeValue((e: string) => {
			value = e;
			const newDueDate = DueDate.helpCreateDueDate(value);
			if (!newDueDate) {
				inputBox.prompt = inputOffset('❌');
				return;
			}
			inputBox.prompt = inputOffset(newDueDate);
		});

		inputBox.onDidAccept(() => {
			if (!value) {
				return;
			}
			const newDueDate = DueDate.helpCreateDueDate(value);
			if (newDueDate) {
				const dueDate = `{due:${newDueDate}}`;
				const wEdit = new WorkspaceEdit();
				if (task?.dueRange) {
					wEdit.replace(editor.document.uri, task.dueRange, dueDate);
				} else {
					wEdit.insert(editor.document.uri, editor.selection.active, ` ${dueDate}`);
				}
				applyEdit(wEdit, editor.document);
				inputBox.hide();
				inputBox.dispose();
			}
		});
	});
	commands.registerCommand('todomd.openDefaultArvhiveFile', async () => {
		const isDefaultFileSpecified = await checkArchiveFileAndNotify();
		if (!isDefaultFileSpecified) {
			return;
		}
		openFileInEditor(extensionConfig.defaultArchiveFile);
	});
	commands.registerCommand('todomd.openDefaultFile', async () => {
		const isDefaultFileSpecified = await checkDefaultFileAndNotify();
		if (!isDefaultFileSpecified) {
			return;
		}
		openFileInEditor(extensionConfig.defaultFile);
	});
	commands.registerCommand('todomd.specifyDefaultFile', specifyDefaultFile);
	commands.registerCommand('todomd.completeTask', async () => {
		// Show Quick Pick to complete a task
		const document = getActiveDocument();
		const notCompletedTasks = state.tasks.filter(task => !task.done).map(task => TheTask.formatTask(task));
		const pickedTask = await window.showQuickPick(notCompletedTasks, {
			placeHolder: 'Choose a task to complete',
		});
		if (!pickedTask) {
			return;
		}
		const task = state.tasks.find(t => TheTask.formatTask(t) === pickedTask);
		if (!task) {
			return;
		}
		if (task.specialTags.count) {
			await incrementCountForTask(document, task.lineNumber, task);
		} else {
			await toggleDoneAtLine(document, task.lineNumber);
		}
		await updateState();
		updateAllTreeViews();
	});
	commands.registerTextEditorCommand('todomd.filter', editor => {
		const quickPick = window.createQuickPick();
		quickPick.items = extensionConfig.savedFilters.map(filter => new QuickPickItem(filter.title));
		let value: string | undefined;
		let selected: string | undefined;
		quickPick.onDidChangeValue(e => {
			value = e;
		});
		quickPick.onDidChangeSelection(e => {
			selected = e[0].label;
		});
		quickPick.show();
		quickPick.onDidAccept(() => {
			let filterStr;
			if (selected) {
				filterStr = extensionConfig.savedFilters.find(filter => filter.title === selected)?.filter;
			} else {
				filterStr = value;
			}
			quickPick.hide();
			quickPick.dispose();
			if (!filterStr || !filterStr.length) {
				return;
			}
			setContext(VscodeContext.filterActive, true);
			state.taskTreeViewFilterValue = filterStr;
			updateTasksTreeView();
		});
	});
	commands.registerCommand('todomd.clearFilter', editor => {
		setContext(VscodeContext.filterActive, false);
		state.taskTreeViewFilterValue = '';
		updateTasksTreeView();
	});
	commands.registerCommand('todomd.clearGlobalState', () => {
	// @ts-ignore No API
		state.extensionContext.globalState._value = {};
		state.extensionContext.globalState.update('hack', 'toClear');// Is this required to clear state?
	});
	commands.registerCommand('todomd.goToLine', async (lineNumber: number) => {
		const range = new vscode.Range(lineNumber, 0, lineNumber, 0);
		let editor;
		if (!state.theRightFileOpened) {
			const isDefaultFileSpecified = await checkDefaultFileAndNotify();
			if (!isDefaultFileSpecified) {
				return;
			}
			const document = getActiveDocument();
			editor = await window.showTextDocument(document);
		} else {
			const { activeTextEditor } = window;
			if (!activeTextEditor) {
				return;
			}
			await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
			editor = activeTextEditor;
		}
		editor.selection = new vscode.Selection(range.start, range.end);
		editor.revealRange(range, vscode.TextEditorRevealType.Default);
	});
	commands.registerTextEditorCommand('todomd.resetAllRecurringTasks', editor => {
		resetAllRecurringTasks();
	});
	commands.registerCommand('todomd.followLink', (treeItem: TaskTreeItem) => {
		const link = treeItem.task.links[0]?.value;
		if (link) {
			followLink(link);
		}
	});
	commands.registerCommand('todomd.setLastVisit', async () => {
		const numberOfHours = Number(await vscode.window.showInputBox({
			prompt: 'Number of Hours ago',
		}));
		if (!numberOfHours) {
			return;
		}
		state.extensionContext.globalState.update(LAST_VISIT_STORAGE_KEY, dayjs().subtract(numberOfHours, 'hour').toDate());
	});
	commands.registerTextEditorCommand('todomd.incrementPriority', editor => {
		const lineNumber = editor.selection.active.line;
		incrementOrDecrementPriority(editor.document, lineNumber, 'increment');
	});
	commands.registerTextEditorCommand('todomd.decrementPriority', editor => {
		const lineNumber = editor.selection.active.line;
		incrementOrDecrementPriority(editor.document, lineNumber, 'decrement');
	});
	commands.registerCommand('todomd.showWebviewSettings', (treeItem: TaskTreeItem) => {
		openSettingGuiAt('todomd.webview');
	});
}

function noArchiveFileMessage() {
	vscode.window.showWarningMessage('No default archive file specified');
}

export async function checkDefaultFileAndNotify(): Promise<boolean> {
	const specify = 'Specify';
	if (!extensionConfig.defaultFile) {
		const shouldSpecify = await window.showWarningMessage('Default file is not specified.', specify);
		if (shouldSpecify === specify) {
			specifyDefaultFile();
		}
		return false;
	} else {
		const exists = fs.existsSync(extensionConfig.defaultFile);
		if (!exists) {
			const shouldSpecify = await window.showErrorMessage('Default file does not exist.', specify);
			if (shouldSpecify === specify) {
				specifyDefaultFile();
			}
			return false;
		} else {
			return true;
		}
	}
}
async function checkArchiveFileAndNotify(): Promise<boolean> {
	const specify = 'Specify';
	if (!extensionConfig.defaultArchiveFile) {
		const shouldSpecify = await window.showWarningMessage('Default archive file is not specified.', specify);
		if (shouldSpecify === specify) {
			specifyDefaultArchiveFile();
		}
		return false;
	} else {
		const exists = fs.existsSync(extensionConfig.defaultArchiveFile);
		if (!exists) {
			const shouldSpecify = await window.showErrorMessage('Specified default archive file does not exist.', specify);
			if (shouldSpecify === specify) {
				specifyDefaultArchiveFile();
			}
			return false;
		} else {
			return true;
		}
	}
}
function specifyDefaultFile() {
	openSettingGuiAt('todomd.defaultFile');
}
function specifyDefaultArchiveFile() {
	openSettingGuiAt('todomd.defaultArchiveFile');
}
export function insertCompletionDate(wEdit: WorkspaceEdit, uri: Uri, line: TextLine) {
	wEdit.insert(uri, new vscode.Position(line.lineNumber, line.range.end.character), ` {cm:${getDateInISOFormat(new Date(), extensionConfig.completionDateIncludeTime)}}`);
}
export function removeDoneSymbol(wEdit: WorkspaceEdit, uri: Uri, line: vscode.TextLine) {
	if (line.text.trim().startsWith(extensionConfig.doneSymbol)) {
		wEdit.delete(uri, new Range(line.lineNumber, line.firstNonWhitespaceCharacterIndex, line.lineNumber, line.firstNonWhitespaceCharacterIndex + extensionConfig.doneSymbol.length));
	}
}
export function setCountCurrentValue(wEdit: WorkspaceEdit, uri: Uri, count: Count, value: string) {
	const charIndexWithOffset = count.range.start.character + 'count:'.length + 1;
	const currentRange = new vscode.Range(count.range.start.line, charIndexWithOffset, count.range.start.line, charIndexWithOffset + String(count.current).length);
	wEdit.replace(uri, currentRange, String(value));
}
export function getTaskAtLine(lineNumber: number): TheTask | undefined {
	for (const line of state.tasks) {
		if (line.lineNumber === lineNumber) {
			return line;
		}
	}
	return undefined;
}
/**
 * Updates state for archived tasks
 */
export async function updateArchivedTasks() {
	if (!extensionConfig.defaultArchiveFile) {
		return;
	}
	const document = await workspace.openTextDocument(vscode.Uri.file(extensionConfig.defaultArchiveFile));
	const parsedArchiveTasks = await parseDocument(document);
	state.archivedTasks = parsedArchiveTasks.tasks;
	updateArchivedTasksTreeView();
}
/**
 * vscode `WorkspaceEdit` allowes changing files that are not even opened.
 *
 * `document.save()` is needed to prevent opening those files after applying the edit.
 */
export async function applyEdit(wEdit: WorkspaceEdit, document: vscode.TextDocument) {
	await workspace.applyEdit(wEdit);
	return await document.save();
}

