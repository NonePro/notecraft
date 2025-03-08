import { commands, window } from 'vscode';
import { TheTask } from './TheTask';
import { addTaskToActiveFile } from './commands/addTaskToActiveFile';
import { addTaskToActiveFileWebview } from './commands/addTaskToActiveFileWebview';
import { addTaskToDefaultFile } from './commands/addTaskToDefaultFile';
import { applyFilterToTreeViewCommand } from './commands/applyFilterToTreeView';
import { archiveCompletedTasks } from './commands/archiveCompletedTasks';
import { clearGlobalState } from './commands/clearGlobalState';
import { clearTreeViewFilter } from './commands/clearTreeViewFilter';
import { collapseAllNestedTasks } from './commands/collapseAllNestedTasks';
import { completeTask } from './commands/completeTask';
import { createSimilarTask } from './commands/createSimilarTask';
import { decrementPriority } from './commands/decrementPriority';
import { deleteTask } from './commands/deleteTask';
import { expandAllNestedTasks } from './commands/expandAllNestedTasks';
import { focusTasksWebviewAndInput } from './commands/focusTasksWebviewAndInput';
import { followLinkCommand } from './commands/followLinkCommand';
import { getFewNextTasksCommand } from './commands/getFewNextTasks';
import { getNextTask } from './commands/getNextTask';
import { getRandomTask } from './commands/getRandomTask';
import { goToLine } from './commands/goToLine';
import { goToLineInArchived } from './commands/goToLineInArchived';
import { hideTask } from './commands/hideTask';
import { incrementPriority } from './commands/incrementPriority';
import { mainStatusBarCommand } from './commands/mainStatusBarCommand';
import { moveToSomeday } from './commands/moveToSomeday';
import { openDefaultArchiveFile } from './commands/openDefaultArchiveFile';
import { openDefaultFile } from './commands/openDefaultFile';
import { openSomedayFile } from './commands/openSomedayFile';
import { PickWebviewSortCommand } from './commands/pickWebviewSortCommand';
import { removeAllOverdue } from './commands/removeAllOverdue';
import { removeOverdue } from './commands/removeOverdue';
import { resetAllRecurringTasksCommand } from './commands/resetAllRecurringTasks';
import { setDueDate } from './commands/setDueDate';
import { setDueDateWithArgs } from './commands/setDueDateWithArgs';
import { setLastVisit } from './commands/setLastVisit';
import { showGlobalState } from './commands/showGlobalState';
import { showWebviewSettings } from './commands/showWebviewSettings';
import { sortTasksInEditorCommand } from './commands/sortTasksCommand';
import { specifyDefaultArchiveFileCommand } from './commands/specifyDefaultArchiveFile';
import { specifyDefaultFileCommand } from './commands/specifyDefaultFile';
import { specifyDefaultSomedayFileCommand } from './commands/specifyDefaultSomedayFile';
import { startTask } from './commands/startTask';
import { toggleComment } from './commands/toggleComment';
import { toggleContextsTreeViewSorting } from './commands/toggleContextsTreeViewSorting';
import { toggleDone } from './commands/toggleDone';
import { toggleFavoriteTask } from './commands/toggleFavoriteTask';
import { toggleProjectsTreeViewSorting } from './commands/toggleProjectsTreeViewSorting';
import { toggleTagsTreeViewSorting } from './commands/toggleTagsTreeViewSorting';
import { webviewToggleShowRecurringUpcoming } from './commands/webviewToggleShowRecurringUpcoming';
import { appendTaskToFile } from './documentActions';
import { $config } from './extension';
import { getDateInISOFormat } from './time/timeUtils';
import { formatTask } from './utils/taskUtils';
import { followLinks } from './utils/vscodeUtils';
import { createFileCommand } from './commands/createFileCommand';

/**
 * All commands contributed by this extension.
 */
export const enum CommandId {
	// ──── Sort ──────────────────────────────────────────────────
	SortByDefault = 'notecraft.sortByDefault',
	SortByPriority = 'notecraft.sortByPriority',
	SortByProject = 'notecraft.sortByProject',
	SortByTag = 'notecraft.sortByTag',
	SortByContext = 'notecraft.sortByContext',
	SortByCreationDate = 'notecraft.sortByCreationDate',
	SortByCompletionDate = 'notecraft.sortByCompletionDate',
	SortByDueDate = 'notecraft.sortByDueDate',
	// ────────────────────────────────────────────────────────────
	CreateFile = 'notecraft.createFile',
	ToggleDone = 'notecraft.toggleDone',
	ToggleFavorite = 'notecraft.toggleFavorite',
	HideTask = 'notecraft.hideTask',
	CollapseAllNestedTasks = 'notecraft.collapseAllNestedTasks',
	ExpandAllTasks = 'notecraft.expandAllTasks',
	FocusTasksWebviewAndInput = 'notecraft.focusTasksWebviewAndInput',
	DeleteTask = 'notecraft.deleteTask',
	ArchiveCompletedTasks = 'notecraft.archiveCompletedTasks',
	ArchiveSelectedCompletedTasks = 'notecraft.archiveSelectedCompletedTasks',
	StartTask = 'notecraft.startTask',
	RemoveOverdue = 'notecraft.removeOverdue',
	MoveToSomeday = 'notecraft.moveToSomeday',
	CreateSimilarTask = 'notecraft.createSimilarTask',
	GetNextTask = 'notecraft.getNextTask',
	GetFewNextTasks = 'notecraft.getFewNextTasks',
	GetRandomTask = 'notecraft.getRandomTask',
	AddTaskToDefaultFile = 'notecraft.addTaskToDefaultFile',
	AddTaskToActiveFile = 'notecraft.addTaskToActiveFile',
	AddTaskToActiveFileWebview = 'notecraft.addTaskToActiveFileWebview',
	SetDueDate = 'notecraft.setDueDate',
	SetDueDateWithArgs = 'notecraft.setDueDateWithArgs',
	OpenDefaultFile = 'notecraft.openDefaultFile',
	OpenDefaultArchiveFile = 'notecraft.openDefaultArchiveFile',
	OpenSomedayFile = 'notecraft.openSomedayFile',
	SpecifyDefaultFile = 'notecraft.specifyDefaultFile',
	SpecifyDefaultArchiveFile = 'notecraft.specifyDefaultArchiveFile',
	SpecifyDefaultSomedayFile = 'notecraft.specifyDefaultSomedayFile',
	CompleteTask = 'notecraft.completeTask',
	ApplyFilterToTreeView = 'notecraft.applyFilterToTreeView',
	ClearTreeViewFilter = 'notecraft.clearTreeViewFilter',
	GoToLine = 'notecraft.goToLine',
	GoToLineInArchived = 'notecraft.goToLineInArchived',
	ResetAllRecurringTasks = 'notecraft.resetAllRecurringTasks',
	FollowLink = 'notecraft.followLink',
	IncrementPriority = 'notecraft.incrementPriority',
	DecrementPriority = 'notecraft.decrementPriority',
	ShowWebviewSettings = 'notecraft.showWebviewSettings',
	PickWebviewSort = 'notecraft.webview.pickSort',
	WebviewToggleShowRecurringUpcoming = 'notecraft.webview.toggleShowRecurringUpcoming',
	ToggleComment = 'notecraft.toggleComment',
	ToggleTagsTreeViewSorting = 'notecraft.toggleTagsTreeViewSorting',
	ToggleProjectsTreeViewSorting = 'notecraft.toggleProjectsTreeViewSorting',
	ToggleContextsTreeViewSorting = 'notecraft.toggleContextsTreeViewSorting',
	// ──── Dev ───────────────────────────────────────────────────
	SetLastVisit = 'notecraft.dev.setLastVisit',
	ClearGlobalState = 'notecraft.dev.clearGlobalState',
	ShowGlobalState = 'notecraft.dev.showGlobalState',
	RemoveAllOverdue = 'notecraft.dev.removeAllOverdue',
	// ──── Internal ──────────────────────────────────────────────
	MainStatusBarCommand = 'notecraft.mainStatusBarCommand',
}

/**
 * Register all commands. Names should match **"commands"** in `package.json`
 */
export function registerAllCommands() {
	commands.registerCommand(CommandId.ToggleDone, toggleDone);
	commands.registerCommand(CommandId.HideTask, hideTask);
	commands.registerCommand(CommandId.CollapseAllNestedTasks, collapseAllNestedTasks);
	commands.registerCommand(CommandId.ExpandAllTasks, expandAllNestedTasks);
	commands.registerCommand(CommandId.FocusTasksWebviewAndInput, focusTasksWebviewAndInput);
	commands.registerCommand(CommandId.DeleteTask, deleteTask);
	commands.registerCommand(CommandId.StartTask, startTask);
	commands.registerCommand(CommandId.GetNextTask, getNextTask);
	commands.registerCommand(CommandId.GetFewNextTasks, getFewNextTasksCommand);
	commands.registerCommand(CommandId.GetRandomTask, getRandomTask);
	commands.registerCommand(CommandId.AddTaskToDefaultFile, addTaskToDefaultFile);
	commands.registerCommand(CommandId.AddTaskToActiveFile, addTaskToActiveFile);
	commands.registerCommand(CommandId.AddTaskToActiveFileWebview, addTaskToActiveFileWebview);
	commands.registerCommand(CommandId.SetDueDateWithArgs, setDueDateWithArgs);
	commands.registerCommand(CommandId.OpenDefaultFile, openDefaultFile);
	commands.registerCommand(CommandId.OpenDefaultArchiveFile, openDefaultArchiveFile);
	commands.registerCommand(CommandId.OpenSomedayFile, openSomedayFile);
	commands.registerCommand(CommandId.SpecifyDefaultFile, specifyDefaultFileCommand);
	commands.registerCommand(CommandId.SpecifyDefaultArchiveFile, specifyDefaultArchiveFileCommand);
	commands.registerCommand(CommandId.SpecifyDefaultSomedayFile, specifyDefaultSomedayFileCommand);
	commands.registerCommand(CommandId.CompleteTask, completeTask);
	commands.registerCommand(CommandId.ApplyFilterToTreeView, applyFilterToTreeViewCommand);
	commands.registerCommand(CommandId.ClearTreeViewFilter, clearTreeViewFilter);
	commands.registerCommand(CommandId.ClearGlobalState, clearGlobalState);
	commands.registerCommand(CommandId.ShowGlobalState, showGlobalState);
	commands.registerCommand(CommandId.RemoveAllOverdue, removeAllOverdue);
	commands.registerCommand(CommandId.GoToLine, goToLine);
	commands.registerCommand(CommandId.GoToLineInArchived, goToLineInArchived);
	commands.registerCommand(CommandId.FollowLink, followLinkCommand);
	commands.registerCommand(CommandId.ShowWebviewSettings, showWebviewSettings);
	commands.registerCommand(CommandId.PickWebviewSort, PickWebviewSortCommand);
	commands.registerCommand(CommandId.WebviewToggleShowRecurringUpcoming, webviewToggleShowRecurringUpcoming);
	commands.registerCommand(CommandId.ToggleTagsTreeViewSorting, toggleTagsTreeViewSorting);
	commands.registerCommand(CommandId.ToggleProjectsTreeViewSorting, toggleProjectsTreeViewSorting);
	commands.registerCommand(CommandId.ToggleContextsTreeViewSorting, toggleContextsTreeViewSorting);
	commands.registerCommand(CommandId.ToggleFavorite, toggleFavoriteTask);
	// ──── Require Text Editor ───────────────────────────────────
	commands.registerTextEditorCommand(CommandId.RemoveOverdue, removeOverdue);
	commands.registerTextEditorCommand(CommandId.SetLastVisit, setLastVisit);
	commands.registerTextEditorCommand(CommandId.IncrementPriority, incrementPriority);
	commands.registerTextEditorCommand(CommandId.ResetAllRecurringTasks, resetAllRecurringTasksCommand);
	commands.registerTextEditorCommand(CommandId.DecrementPriority, decrementPriority);
	commands.registerTextEditorCommand(CommandId.ToggleComment, toggleComment);
	commands.registerTextEditorCommand(CommandId.SortByDefault, (editor, edit) => sortTasksInEditorCommand(editor, edit, 'Default'));
	commands.registerTextEditorCommand(CommandId.SortByPriority, (editor, edit) => sortTasksInEditorCommand(editor, edit, 'priority'));
	commands.registerTextEditorCommand(CommandId.SortByProject, (editor, edit) => sortTasksInEditorCommand(editor, edit, 'project'));
	commands.registerTextEditorCommand(CommandId.SortByTag, (editor, edit) => sortTasksInEditorCommand(editor, edit, 'tag'));
	commands.registerTextEditorCommand(CommandId.SortByContext, (editor, edit) => sortTasksInEditorCommand(editor, edit, 'context'));
	commands.registerTextEditorCommand(CommandId.SortByCreationDate, (editor, edit) => sortTasksInEditorCommand(editor, edit, 'creationDate'));
	commands.registerTextEditorCommand(CommandId.SortByCompletionDate, (editor, edit) => sortTasksInEditorCommand(editor, edit, 'completionDate'));
	commands.registerTextEditorCommand(CommandId.SortByDueDate, (editor, edit) => sortTasksInEditorCommand(editor, edit, 'dueDate'));
	commands.registerTextEditorCommand(CommandId.CreateSimilarTask, createSimilarTask);
	commands.registerTextEditorCommand(CommandId.ArchiveCompletedTasks, archiveCompletedTasks);
	commands.registerTextEditorCommand(CommandId.MoveToSomeday, moveToSomeday);
	commands.registerTextEditorCommand(CommandId.SetDueDate, setDueDate);
	// ──── Internal ──────────────────────────────────────────────
	commands.registerCommand(CommandId.MainStatusBarCommand, mainStatusBarCommand);
	commands.registerCommand(CommandId.CreateFile, createFileCommand);
}
/**
 * Append task to the file.
 *
 * Optionally adds creation date if user configured `addCreationDate`.
 */
export async function addTaskToFile(text: string, filePath: string) {
	const creationDate = $config.addCreationDate ? `{cr:${getDateInISOFormat(new Date(), $config.creationDateIncludeTime)}} ` : '';
	return await appendTaskToFile(`${creationDate}${text}`, filePath);
}
/**
 * Show formatted task in notification. Also show button to Follow link if links are present in this task.
 */
export async function showTaskInNotification(task: TheTask) {
	const formattedTask = formatTask(task);
	if (task.links.length) {
		const buttonFollowLink = 'Follow link';
		const shouldFollow = await window.showInformationMessage(formattedTask, buttonFollowLink);
		if (shouldFollow === buttonFollowLink) {
			followLinks(task.links);
		}
	} else {
		window.showInformationMessage(formattedTask);
	}
}

