import dayjs from 'dayjs';
import throttle from 'lodash/throttle';
import { Disposable, languages, TextDocumentChangeEvent, TextEditor, window, workspace } from 'vscode';
import { getNextFewTasks } from './commands/getFewNextTasks';
import { Constants } from './constants';
import { disposeDecorations, doUpdateEditorDecorations } from './decorations';
import { resetAllRecurringTasks } from './documentActions';
import { $config, $state, updateLastVisitGlobalState, updateState } from './extension';
import { clearDiagnostics, updateDiagnostic } from './languageFeatures/diagnostics';
import { updateAllTreeViews } from './treeViewProviders/treeViews';
import { VscodeContext } from './types';
import { getDocumentForDefaultFile } from './utils/extensionUtils';
import { setContext } from './utils/vscodeUtils';

let changeTextDocumentDisposable: Disposable | undefined;
let changeActiveTextEditorDisposable: Disposable | undefined;

/**
 * Active text editor changes (tab).
 *
 * This event can be fired multiple times very quickly 5-20ms interval.
 */
export async function onChangeActiveTextEditor(editor: TextEditor | undefined): Promise<void> {
	if ($state.theRightFileOpened) {
		deactivateEditorFeatures();
	}
	if (editor && isTheRightFileName(editor)) {
		$state.activeDocument = editor.document;
		$state.activeDocumentTabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : $config.tabSize;
		await updateEverything(editor);
		activateEditorFeatures(editor);
		await setContext(VscodeContext.IsActive, true);

		const needReset = checkIfNeedResetRecurringTasks(editor.document.uri.toString());
		if (needReset) {
			await resetAllRecurringTasks(editor.document, needReset.lastVisit);
			await updateEverything();
			await updateLastVisitGlobalState(editor.document.uri.toString(), new Date());
		}
	} else {
		$state.activeDocument = await getDocumentForDefaultFile();
		$state.activeDocumentTabSize = $config.tabSize;
		$state.theRightFileOpened = false;
		await updateEverything();
		await setContext(VscodeContext.IsActive, false);
	}
}
/**
 * Only run reset all recurring tasks when needed (first open file in a day)
 */
export function checkIfNeedResetRecurringTasks(filePath: string): {lastVisit: Date} | undefined {
	const lastVisitForFile = $state.lastVisitByFile[filePath];
	if (lastVisitForFile) {
		if (!dayjs().isSame(lastVisitForFile, 'day')) {
			// First time this file opened this day => reset
			return {
				lastVisit: lastVisitForFile,
			};
		} else {
			// This file was already reset this day
			return undefined;
		}
	} else {
		// New file
		return {
			lastVisit: new Date(),
		};
	}
}
/**
 * Called when active text document changes (typing in it, for instance)
 */
export function onChangeTextDocument(e: TextDocumentChangeEvent) {
	const activeTextEditor = window.activeTextEditor;
	if (activeTextEditor && $state.theRightFileOpened) {
		updateEverything(activeTextEditor);
	}
}
/**
 * Match Uri of editor against a glob specified by user.
 */
export function isTheRightFileName(editor: TextEditor): boolean {
	return languages.match({
		pattern: $config.activatePattern,
	},	editor.document) !== 0;
}
/**
 * Activate document text change event listener.
 */
export function activateEditorFeatures(editor: TextEditor) {
	$state.theRightFileOpened = true;
	changeTextDocumentDisposable = workspace.onDidChangeTextDocument(onChangeTextDocument);
	$state.progressStatusBar.show();
}
/**
 * Deactivate document text change event listener.
 */
export function deactivateEditorFeatures() {
	changeTextDocumentDisposable?.dispose();
	$state.progressStatusBar.hide();
}
export function disposeEditorDisposables() {
	disposeDecorations();
	changeTextDocumentDisposable?.dispose();
}

export function updateOnDidChangeActiveEditor() {
	/**
	 * The event is fired twice quickly when closing an editor, also when swtitching to untitled file ???
	 */
	changeActiveTextEditorDisposable = window.onDidChangeActiveTextEditor(throttle(onChangeActiveTextEditor, 25, {
		leading: false,
	}));
}
export function disposeActiveEditorChange() {
	changeActiveTextEditorDisposable?.dispose();
}
/**
 * - Update state (parse the active/default file)
 * - Update editor decorations
 * - Update status bar item
 * - Update all tree views (including webview, excluding archived tasks)
 */
export const updateEverything = throttle(async (editor?: TextEditor) => {
	await updateState();
	if (editor && isTheRightFileName(editor)) {
		doUpdateEditorDecorations(editor);
		$state.progressStatusBar.update($state.tasks);
		updateDiagnostic(editor, $state.tasksAsTree);
	} else {
		clearDiagnostics();
	}
	$state.mainStatusBar.update(getNextFewTasks());
	updateAllTreeViews();
}, Constants.ThrottleEverything);
