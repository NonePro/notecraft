import dayjs from 'dayjs';
import { Position, Range, Selection, TextDocument, TextEditorRevealType, TextLine, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import { DueDate } from './dueDate';
import { extensionConfig } from './extension';
import { parseDocument } from './parse';
import { Count, TheTask } from './TheTask';
import { dateWithoutTime, DATE_FORMAT, durationTo, getDateInISOFormat } from './time/timeUtils';
import { updateArchivedTasks } from './treeViewProviders/treeViews';
import { DueState } from './types';
import { applyEdit, checkArchiveFileAndNotify, getActiveOrDefaultDocument, specialTag, SpecialTagName, taskToString } from './utils/extensionUtils';
import { forEachTask, getTaskAtLineExtension } from './utils/taskUtils';

// This file contains 2 types of functions
// 1) Performs an action on the document and returns a Promise
// 2) Has a `WorkspaceEdit` suffix that accepts an edit and returns it without applying

export async function editTask(document: TextDocument, task: TheTask) {
	const edit = new WorkspaceEdit();
	const newTaskAsText = taskToString(task);
	const line = document.lineAt(task.lineNumber);
	edit.replace(document.uri, line.range, newTaskAsText);
	return applyEdit(edit, document);
}
/**
 * Add `{h}` special tag
 */
export async function hideTask(document: TextDocument, lineNumber: number) {
	const edit = new WorkspaceEdit();
	const line = document.lineAt(lineNumber);
	const task = getTaskAtLineExtension(lineNumber);
	if (!task) {
		return undefined;
	}
	if (!task.isHidden) {
		edit.insert(document.uri, line.range.end, ' {h}');
	}
	return applyEdit(edit, document);
}
export async function editTaskRawText(document: TextDocument, lineNumber: number, newRawText: string) {
	const edit = new WorkspaceEdit();
	const line = document.lineAt(lineNumber);
	edit.replace(document.uri, line.range, newRawText);
	return applyEdit(edit, document);
}
/**
 * Toggle `{c}` special tag
 */
export async function toggleTaskCollapse(document: TextDocument, lineNumber: number) {
	const edit = new WorkspaceEdit();
	toggleTaskCollapseWorkspaceEdit(edit, document, lineNumber);
	return applyEdit(edit, document);
}
/**
 * Recursively expand/collapse all nested tasks
 */
export async function toggleTaskCollapseRecursive(document: TextDocument, lineNumber: number) {
	const parentTask = getTaskAtLineExtension(lineNumber);
	if (!parentTask) {
		return undefined;
	}
	const edit = new WorkspaceEdit();

	if (parentTask.isCollapsed) {
		forEachTask(task => {
			if (task.isCollapsed && task.subtasks.length) {
				toggleTaskCollapseWorkspaceEdit(edit, document, task.lineNumber);
			}
		}, parentTask.subtasks);
	} else {
		forEachTask(task => {
			if (!task.isCollapsed && task.subtasks.length) {
				toggleTaskCollapseWorkspaceEdit(edit, document, task.lineNumber);
			}
		}, parentTask.subtasks);
	}
	toggleTaskCollapseWorkspaceEdit(edit, document, lineNumber);
	return await applyEdit(edit, document);
}
/**
 * Insert/Replace due date
 */
export async function setDueDate(document: TextDocument, lineNumber: number, newDueDate: string) {
	const dueDate = `{due:${newDueDate}}`;
	const edit = new WorkspaceEdit();
	const task = getTaskAtLineExtension(lineNumber);
	if (task?.overdueRange) {
		edit.delete(document.uri, task.overdueRange);
	}
	if (task?.dueRange) {
		edit.replace(document.uri, task.dueRange, dueDate);
	} else {
		const line = document.lineAt(lineNumber);
		const isLineEndsWithWhitespace = line.text.endsWith(' ');
		edit.insert(document.uri, line.range.end, `${isLineEndsWithWhitespace ? '' : ' '}${dueDate}`);
	}
	return await applyEdit(edit, document);
}
/**
 * Start time tracking (task duration). Triggered manually by user.
 */
export async function startTask(document: TextDocument, lineNumber: number) {
	const edit = new WorkspaceEdit();
	const line = document.lineAt(lineNumber);
	const task = getTaskAtLineExtension(lineNumber);
	if (!task) {
		return undefined;
	}
	const newStartDate = specialTag(SpecialTagName.started, getDateInISOFormat(undefined, true));
	if (task.startRange) {
		edit.replace(document.uri, task.startRange, newStartDate);
	} else {
		edit.insert(document.uri, line.range.end, ` ${newStartDate}`);
	}
	return await applyEdit(edit, document);
}
/**
 * Delete the task. Show confirmation dialog if necessary. Modal dialog shows all the tasks that will be deleted.
 */
export async function tryToDeleteTask(document: TextDocument, lineNumber: number) {
	const task = getTaskAtLineExtension(lineNumber);
	if (!task) {
		return undefined;
	}
	const edit = new WorkspaceEdit();

	let numberOfTasksToBeDeleted = '';
	let deletedTasksAsText = '';
	let showConfirmationDialog = false;

	const taskLineNumbersToDelete = [lineNumber];
	if (task.subtasks.length) {
		taskLineNumbersToDelete.push(...TheTask.getNestedTasksLineNumbers(task.subtasks));
	}

	for (const ln of taskLineNumbersToDelete) {
		const taskAtLine = getTaskAtLineExtension(ln);
		if (!taskAtLine) {
			continue;
		}
		deletedTasksAsText += `${taskAtLine.rawText.replace(/\s\s/g, '┄')}\n`;
	}
	numberOfTasksToBeDeleted = `❗ [ ${taskLineNumbersToDelete.length} ] task${taskLineNumbersToDelete.length > 1 ? 's' : ''} will be deleted.`;

	if (extensionConfig.confirmTaskDelete === 'always') {
		showConfirmationDialog = true;
	} else if (extensionConfig.confirmTaskDelete === 'hasNestedTasks') {
		if (task.subtasks.length) {
			showConfirmationDialog = true;
		}
	}

	if (showConfirmationDialog) {
		const confirmBtnName = 'Delete';
		const button = await window.showWarningMessage(`${numberOfTasksToBeDeleted}\n${deletedTasksAsText}`, {
			modal: true,
		}, confirmBtnName);
		if (button !== confirmBtnName) {
			return undefined;
		}
	}

	for (const ln of taskLineNumbersToDelete) {
		deleteTaskWorkspaceEdit(edit, document, ln);
	}

	return applyEdit(edit, document);
}
/**
 * Either toggle done or increment count
 */
export async function toggleDoneOrIncrementCount(document: TextDocument, lineNumber: number) {
	const task = getTaskAtLineExtension(lineNumber);
	if (!task) {
		return undefined;
	}
	if (task.count) {
		return await incrementCountForTask(document, lineNumber, task);
	} else {
		await toggleDoneAtLine(document, lineNumber);
		return undefined;
	}
}
/**
 * Increment count special tag. If already max `3/3` then set it to `0/3`
 */
export async function incrementCountForTask(document: TextDocument, lineNumber: number, task: TheTask) {
	const line = document.lineAt(lineNumber);
	const edit = new WorkspaceEdit();
	const count = task.count;
	if (!count) {
		return Promise.resolve(undefined);
	}
	let newValue = 0;
	// TODO: this function must call toggleDoneAtLine() !!!
	if (count.current !== count.needed) {
		newValue = count.current + 1;
		if (newValue === count.needed) {
			insertCompletionDateWorkspaceEdit(edit, document, line, task);
			removeOverdueWorkspaceEdit(edit, document.uri, task);
		}
		setCountCurrentValueWorkspaceEdit(edit, document.uri, count, String(newValue));
	} else {
		setCountCurrentValueWorkspaceEdit(edit, document.uri, count, '0');
		removeCompletionDateWorkspaceEdit(edit, document.uri, task);
	}
	return applyEdit(edit, document);
}
/**
 * Decrement count special tag. If alredy min `0/3` then do nothing.
 */
export async function decrementCountForTask(document: TextDocument, lineNumber: number, task: TheTask) {
	const edit = new WorkspaceEdit();
	const count = task.count;
	if (!count) {
		return undefined;
	}
	if (count.current === 0) {
		return undefined;
	} else if (count.current === count.needed) {
		removeCompletionDateWorkspaceEdit(edit, document.uri, task);
	}
	setCountCurrentValueWorkspaceEdit(edit, document.uri, count, String(count.current - 1));
	return applyEdit(edit, document);
}
/**
 * Increment/Decrement a priority. Create it if the task doesn't have one.
 */
export async function incrementOrDecrementPriority(document: TextDocument, lineNumber: number, type: 'decrement' | 'increment') {
	const task = getTaskAtLineExtension(lineNumber);
	if (!task ||
			type === 'increment' && task.priority === 'A' ||
			type === 'decrement' && task.priority === 'Z') {
		return undefined;
	}
	const newPriority = type === 'increment' ? String.fromCharCode(task.priority.charCodeAt(0) - 1) : String.fromCharCode(task.priority.charCodeAt(0) + 1);
	const edit = new WorkspaceEdit();
	if (task.priorityRange) {
		// Task has a priority
		edit.replace(document.uri, task.priorityRange, `(${newPriority})`);
	} else {
		// No priority, create one
		edit.insert(document.uri, new Position(lineNumber, 0), `(${newPriority}) `);
	}
	return applyEdit(edit, document);
}
/**
 * Remove overdue special tag
 */
async function removeOverdueFromLine(document: TextDocument, task: TheTask) {
	const edit = new WorkspaceEdit();
	removeOverdueWorkspaceEdit(edit, document.uri, task);
	return applyEdit(edit, document);
}
/**
 * Toggle task completion. Handle what to insert/delete.
 */
export async function toggleDoneAtLine(document: TextDocument, lineNumber: number) {
	const task = getTaskAtLineExtension(lineNumber);
	if (!task) {
		return;
	}
	if (task.overdue) {
		await removeOverdueFromLine(document, task);
	}
	const line = document.lineAt(lineNumber);
	const edit = new WorkspaceEdit();
	if (task.done) {
		removeCompletionDateWorkspaceEdit(edit, document.uri, task);
		removeDurationWorkspaceEdit(edit, document.uri, task);
		removeStartWorkspaceEdit(edit, document.uri, task);
	} else {
		insertCompletionDateWorkspaceEdit(edit, document, line, task);
	}
	await applyEdit(edit, document);

	if (extensionConfig.autoArchiveTasks) {
		await archiveTasks([task], document);
	}
}
/**
 * - Warning and noop when default archive file path is not specified
 * - Archive only works for completed tasks
 * - When the task is non-root (has parent task) - noop
 * - When the task has subtasks -> archive them too
 */
export async function archiveTasks(tasks: TheTask[], document: TextDocument) {
	const isDefaultArchiveFileSpecified = await checkArchiveFileAndNotify();
	if (!isDefaultArchiveFileSpecified) {
		return undefined;
	}

	const fileEdit = new WorkspaceEdit();
	const archiveFileEdit = new WorkspaceEdit();
	const archiveFileUri = Uri.file(extensionConfig.defaultArchiveFile);
	const archiveDocument = await workspace.openTextDocument(archiveFileUri);
	let taskLineNumbersToArchive = [];

	for (const task of tasks) {
		// Only root tasks provided will be archived
		if (task.parentTaskLineNumber !== undefined) {
			continue;
		}
		// Recurring tasks cannot be archived
		if (task.due?.isRecurring) {
			continue;
		}
		taskLineNumbersToArchive.push(task.lineNumber);
		if (task.subtasks.length) {
			taskLineNumbersToArchive.push(...TheTask.getNestedTasksLineNumbers(task.subtasks));
		}
	}

	taskLineNumbersToArchive = Array.from(new Set(taskLineNumbersToArchive));
	for (const lineNumber of taskLineNumbersToArchive) {
		const task = getTaskAtLineExtension(lineNumber);
		if (!task) {
			continue;
		}
		const line = document.lineAt(lineNumber);
		archiveTaskWorkspaceEdit(fileEdit, archiveFileEdit, archiveDocument, document.uri, line, true);
	}

	await applyEdit(fileEdit, document);
	await applyEdit(archiveFileEdit, archiveDocument);
	updateArchivedTasks();
	return undefined;
}
/**
 * Reveal the line/task in the file.
 *
 * Move cursor, reveal range, highlight the line for a moment
 */
export async function revealTask(lineNumber: number, document?: TextDocument) {
	const documentToReveal = document ?? await getActiveOrDefaultDocument();
	const editor = await window.showTextDocument(documentToReveal);
	const range = new Range(lineNumber, 0, lineNumber, 0);
	editor.selection = new Selection(range.start, range.end);
	editor.revealRange(range, TextEditorRevealType.Default);
	// Highlight for a short time revealed range
	const lineHighlightDecorationType = window.createTextEditorDecorationType({
		backgroundColor: '#ffa30468',
		isWholeLine: true,
	});
	editor.setDecorations(lineHighlightDecorationType, [range]);
	setTimeout(() => {
		editor.setDecorations(lineHighlightDecorationType, []);
	}, 700);
}
/**
 * Recurring tasks completion state should reset every day.
 * This function goes through all tasks in a document and resets their completion/count, adds `{overdue}` tag when needed
 */
export async function resetAllRecurringTasks(document: TextDocument, lastVisit: Date | string = new Date()) {
	if (typeof lastVisit === 'string') {
		lastVisit = new Date(lastVisit);
	}
	const edit = new WorkspaceEdit();
	const tasks = (await parseDocument(document)).tasks;
	const now = new Date();
	const nowWithoutTime = dateWithoutTime(now);

	for (const task of tasks) {
		if (task.due?.isRecurring) {
			const line = document.lineAt(task.lineNumber);
			if (task.done) {
				removeCompletionDateWorkspaceEdit(edit, document.uri, task);
				removeStartWorkspaceEdit(edit, document.uri, task);
				removeDurationWorkspaceEdit(edit, document.uri, task);
			} else {
				if (!task.overdue && !dayjs().isSame(lastVisit, 'day')) {
					const lastVisitWithoutTime = dateWithoutTime(lastVisit);
					const daysSinceLastVisit = dayjs(nowWithoutTime).diff(lastVisitWithoutTime, 'day');
					for (let i = daysSinceLastVisit; i > 0; i--) {
						const date = dayjs().subtract(i, 'day');
						const res = new DueDate(task.due.raw, {
							targetDate: date.toDate(),
						});
						if (res.isDue === DueState.due || res.isDue === DueState.overdue) {
							addOverdueSpecialTagWorkspaceEdit(edit, document.uri, line, date.format(DATE_FORMAT));
							break;
						}
					}
				}
			}

			const count = task.count;
			if (count) {
				setCountCurrentValueWorkspaceEdit(edit, document.uri, count, '0');
			}
		}
	}
	return applyEdit(edit, document);
}
/**
 * Insert line break `\n` and some text to the file
 */
export async function appendTaskToFile(text: string, filePath: string) {
	const uri = Uri.file(filePath);
	const document = await workspace.openTextDocument(uri);
	const edit = new WorkspaceEdit();
	const eofPosition = document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end;
	edit.insert(uri, eofPosition, `\n${text}`);
	return applyEdit(edit, document);
}

// ──────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────
export function toggleTaskCollapseWorkspaceEdit(edit: WorkspaceEdit, document: TextDocument, lineNumber: number) {
	const line = document.lineAt(lineNumber);
	const task = getTaskAtLineExtension(lineNumber);
	if (task?.collapseRange) {
		edit.delete(document.uri, task.collapseRange);
	} else {
		edit.insert(document.uri, line.range.end, ' {c}');
	}
}
export function deleteTaskWorkspaceEdit(edit: WorkspaceEdit, document: TextDocument, lineNumber: number) {
	edit.delete(document.uri, document.lineAt(lineNumber).rangeIncludingLineBreak);
}
export function removeOverdueWorkspaceEdit(edit: WorkspaceEdit, uri: Uri, task: TheTask) {
	if (task.overdueRange) {
		edit.delete(uri, task.overdueRange);
	}
}
export function insertCompletionDateWorkspaceEdit(edit: WorkspaceEdit, document: TextDocument, line: TextLine, task: TheTask, forceIncludeTime = false) {
	const newCompletionDate = specialTag(SpecialTagName.completionDate, getDateInISOFormat(new Date(), forceIncludeTime || extensionConfig.completionDateIncludeTime));
	if (task.completionDateRange) {
		edit.replace(document.uri, task.completionDateRange, newCompletionDate);
	} else {
		edit.insert(document.uri, new Position(line.lineNumber, line.range.end.character), ` ${newCompletionDate}`);
	}
	if (task.start) {
		insertDurationWorkspaceEdit(edit, document, line, task);
	}
}
export function insertDurationWorkspaceEdit(edit: WorkspaceEdit, document: TextDocument, line: TextLine, task: TheTask) {
	if (!task.start) {
		return;
	}

	const newDurationDate = specialTag(SpecialTagName.duration, durationTo(task, true, extensionConfig.durationIncludeSeconds));
	if (task.durationRange) {
		edit.replace(document.uri, task.durationRange, newDurationDate);
	} else {
		edit.insert(document.uri, line.range.end, ` ${newDurationDate}`);
	}
}
export function removeCompletionDateWorkspaceEdit(edit: WorkspaceEdit, uri: Uri, task: TheTask) {
	if (task.completionDateRange) {
		edit.delete(uri, task.completionDateRange);
	}
}
export function removeDurationWorkspaceEdit(edit: WorkspaceEdit, uri: Uri, task: TheTask) {
	if (task.durationRange) {
		edit.delete(uri, task.durationRange);
	}
}
export function removeStartWorkspaceEdit(edit: WorkspaceEdit, uri: Uri, task: TheTask) {
	if (task.startRange) {
		edit.delete(uri, task.startRange);
	}
}
export function archiveTaskWorkspaceEdit(edit: WorkspaceEdit, archiveFileEdit: WorkspaceEdit, archiveDocument: TextDocument, uri: Uri, line: TextLine, shouldDelete: boolean) {
	appendTaskToFileWorkspaceEdit(archiveFileEdit, archiveDocument, line.text);// Add task to archive file
	if (shouldDelete) {
		edit.delete(uri, line.rangeIncludingLineBreak);// Delete task from active file
	}
}
function addOverdueSpecialTagWorkspaceEdit(edit: WorkspaceEdit, uri: Uri, line: TextLine, overdueDateString: string) {
	edit.insert(uri, new Position(line.lineNumber, line.range.end.character), ` {overdue:${overdueDateString}}`);
}
export function setCountCurrentValueWorkspaceEdit(edit: WorkspaceEdit, uri: Uri, count: Count, value: string) {
	const charIndexWithOffset = count.range.start.character + 'count:'.length + 1;
	const currentRange = new Range(count.range.start.line, charIndexWithOffset, count.range.start.line, charIndexWithOffset + String(count.current).length);
	edit.replace(uri, currentRange, String(value));
}
function appendTaskToFileWorkspaceEdit(edit: WorkspaceEdit, document: TextDocument, text: string) {
	const eofPosition = document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end;
	edit.insert(document.uri, eofPosition, `\n${text}`);
}
export function toggleCommentAtLineWorkspaceEdit(edit: WorkspaceEdit, document: TextDocument, lineNumber: number) {
	const line = document.lineAt(lineNumber);
	if (line.text.startsWith('# ')) {
		edit.delete(document.uri, new Range(lineNumber, 0, lineNumber, 2));
	} else {
		edit.insert(document.uri, new Position(lineNumber, 0), '# ');
	}
}
export function editTaskWorkspaceEdit(edit: WorkspaceEdit, document: TextDocument, task: TheTask) {
	const newTaskAsText = taskToString(task);
	const line = document.lineAt(task.lineNumber);
	edit.replace(document.uri, line.range, newTaskAsText);
}
