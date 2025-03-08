import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import isBetween from 'dayjs/plugin/isBetween';
import isoWeek from 'dayjs/plugin/isoWeek';
import relativeTime from 'dayjs/plugin/relativeTime';
import fs from 'fs';
import path from 'path';
import { ConfigurationChangeEvent, ExtensionContext, Range, TextDocument, window, workspace } from 'vscode';
import { TheTask } from './TheTask';
import { registerAllCommands } from './commands';
import { Constants } from './constants';
import { updateEditorDecorationStyle } from './decorations';
import { resetAllRecurringTasks } from './documentActions';
import { checkIfNeedResetRecurringTasks, disposeActiveEditorChange, disposeEditorDisposables, onChangeActiveTextEditor, updateOnDidChangeActiveEditor } from './events';
import { disposeCompletionProviders } from './languageFeatures/completionProviders';
import { disposeDocumentHighlights } from './languageFeatures/documentHighlights';
import { disposeHover } from './languageFeatures/hoverProvider';
import { updateLanguageFeatures } from './languageFeatures/languageFeatures';
import { disposeReferenceProvider } from './languageFeatures/referenceProvider';
import { disposeRenameProvider } from './languageFeatures/renameProvider';
import { parseDocument } from './parse';
import { MainStatusBar, ProgressStatusBar } from './statusBar';
import { createAllTreeViews, groupAndSortTreeItems, updateAllTreeViews, updateArchivedTasks } from './treeViewProviders/treeViews';
import { ExtensionConfig, ItemForProvider } from './types';
import { updateUserSuggestItems } from './userSuggestItems';
import { getActiveDocument, getDocumentForDefaultFile } from './utils/extensionUtils';
import { getEditorLineHeight } from './utils/vscodeUtils';
import { updateArchivedFilePathNotSetContext, updateIsDevContext } from './vscodeContext';
import { restoreGlobalState } from './vscodeGlobalState';
import { createWebviewView } from './webview/webviewView';

dayjs.extend(isBetween);
dayjs.extend(relativeTime);
dayjs.extend(isoWeek);
dayjs.extend(duration);
dayjs.Ls.en.weekStart = 1;

/**
 * Things extension keeps a global reference to and uses extensively
 */
export abstract class $state {
	/** All tasks (not as tree) */
	static tasks: TheTask[] = [];
	/** Tasks in a tree format (`task.subtasks` contains nested items) */
	static tasksAsTree: TheTask[] = [];
	/** All archived tasks */
	static archivedTasks: TheTask[] = [];
	/** All tags */
	static tags: string[] = [];
	/** All projects */
	static projects: string[] = [];
	/** All contexts */
	static contexts: string[] = [];
	static suggestTags: Record<string, string> = {};
	static suggestProjects: Record<string, string> = {};
	static suggestContexts: Record<string, string> = {};
	/** Tags sorted and grouped for tags Tree View */
	static tagsForTreeView: ItemForProvider[] = [];
	/** Projects sorted and grouped for projects Tree View */
	static projectsForTreeView: ItemForProvider[] = [];
	/** Contexts sorted and grouped for contexts Tree View */
	static contextsForTreeView: ItemForProvider[] = [];
	/** Comment line ranges */
	static commentLines: Range[] = [];
	/** First line of the document or first line after frontmatter header */
	static documentStartLine: number | undefined;
	/** If active text editor matches `activatePattern` config */
	static activeEditorMatchesActivatePattern = false;
	/** If active text editor is archive file (matches `todomd.defaultArchiveFile` setting path). */
	static isActiveFileTheArchiveFile = false;
	/** Last time file was opened (for resetting completion of recurring tasks) */
	static lastVisitByFile: Record<string, Date> = {};
	/** Current filter value of tasks Tree View */
	static taskTreeViewFilterValue: string | undefined = '';
	/** Reference to the extension context for access beyond the `activate()` function */
	static extensionContext = {} as any as ExtensionContext;
	/** Reference to active document. */
	static activeDocument: TextDocument | undefined = undefined;
	/** Used in parsing of nested tasks. */
	static activeDocumentTabSize = 4;
	/** Editor line height (in px) */
	static editorLineHeight = 20;
	/** Main status be item (shows next task). */
	static mainStatusBar: MainStatusBar;
	/** Counter status bar item (in format `1/3 33%`) */
	static progressStatusBar: ProgressStatusBar;
	/** Default file uses ${workspaceFolder} variable. */
	static defaultFilePerWorkspace: boolean;
	/** Default file specified but non-existent (only assigned when using ${workspaceFolder} variable). */
	static defaultFileDoesntExist: boolean;
	/** Replaced value of todomd.defaultFile when ${workspaceFolder} variable used */
	static defaultFileReplacedValue: string;
	/** Replaced value of todomd.defaultArchiveFile when ${workspaceFolder} variable used */
	static defaultArchiveFileReplacedValue: string;
}

export let $config: ExtensionConfig;

export async function activate(context: ExtensionContext) {
	process.on('unhandledRejection', (error) => {
		// Log the error but prevent it from crashing the extension
		console.error('Unhandled promise rejection:', error);
	});

	assignConfig();

	$state.extensionContext = context;

	try {
		const lastVisitByFile = context.globalState.get<typeof $state['lastVisitByFile'] | undefined>(Constants.LastVisitByFileStorageKey);
		$state.lastVisitByFile = lastVisitByFile ? lastVisitByFile : {};
	} catch (error) {
		console.error('Error loading global state data:', error);
		// Initialize with empty object if there's an error loading the global state
		$state.lastVisitByFile = {};
	}

	$state.mainStatusBar = new MainStatusBar();
	$state.progressStatusBar = new ProgressStatusBar();
	$state.editorLineHeight = getEditorLineHeight();
	updateEditorDecorationStyle();
	updateUserSuggestItems();

	try {
		registerAllCommands();
	} catch (error) {
		console.error('Error during command registration:', error);
		// Continue with extension activation even if command registration fails
		// This prevents the ECONNRESET error from stopping the extension activation
	}
	createAllTreeViews();
	createWebviewView(context);
	restoreGlobalState();

	const defaultFileDocument = await getDocumentForDefaultFile();
	if (defaultFileDocument) {
		const filePath = defaultFileDocument.uri.toString();
		const needReset = checkIfNeedResetRecurringTasks(filePath);
		if (needReset) {
			await resetAllRecurringTasks(defaultFileDocument, needReset.lastVisit);
			await updateLastVisitGlobalState(filePath, new Date());
		}
	}

	onChangeActiveTextEditor(window.activeTextEditor);// Trigger on change event at activation

	updateAllTreeViews();
	updateArchivedTasks();
	updateIsDevContext();
	updateArchivedFilePathNotSetContext();

	updateLanguageFeatures();
	updateOnDidChangeActiveEditor();

	function onConfigChange(e: ConfigurationChangeEvent) {
		if (!e.affectsConfiguration(Constants.ExtensionSettingsPrefix)) {
			return;
		}
		updateConfig();
	}

	context.subscriptions.push(workspace.onDidChangeConfiguration(onConfigChange));
}
export function updateConfig() {
	assignConfig();

	disposeEditorDisposables();
	updateLanguageFeatures();
	$state.editorLineHeight = getEditorLineHeight();
	updateEditorDecorationStyle();
	updateUserSuggestItems();
	$state.mainStatusBar.createStatusBarItem();
	$state.progressStatusBar.createStatusBarItem();
	onChangeActiveTextEditor(window.activeTextEditor);
	updateIsDevContext();
	updateArchivedFilePathNotSetContext();
	updateArchivedTasks();
}
/**
 * Update primary `state` properties, such as `tasks` or `tags`, based on provided document or based on default file
 */
export async function updateState() {
	let document = await getActiveDocument();
	if (!document) {
		document = await getDocumentForDefaultFile();
	}
	if (!document) {
		$state.tasks = [];
		$state.tasksAsTree = [];
		$state.tags = [];
		$state.projects = [];
		$state.contexts = [];
		$state.tagsForTreeView = [];
		$state.projectsForTreeView = [];
		$state.contextsForTreeView = [];
		$state.commentLines = [];
		$state.activeEditorMatchesActivatePattern = false;
		$state.isActiveFileTheArchiveFile = false;
		$state.activeDocument = undefined;
		$state.documentStartLine = undefined;
		return;
	}
	const parsedDocument = await parseDocument(document);

	$state.tasks = parsedDocument.tasks;
	$state.tasksAsTree = parsedDocument.tasksAsTree;
	$state.commentLines = parsedDocument.commentLines;
	$state.documentStartLine = parsedDocument.startLine;

	const treeItems = groupAndSortTreeItems($state.tasksAsTree);
	$state.tagsForTreeView = treeItems.tagsForProvider;
	$state.projectsForTreeView = treeItems.projectsForProvider;
	$state.contextsForTreeView = treeItems.contextsForProvider;
	$state.tags = treeItems.tags;
	$state.projects = treeItems.projects;
	$state.contexts = treeItems.contexts;
}
/**
 * Update global storage value of last visit by file
 */
export async function updateLastVisitGlobalState(stringUri: string, date: Date) {
	$state.lastVisitByFile[stringUri] = date;
	await $state.extensionContext.globalState.update(Constants.LastVisitByFileStorageKey, $state.lastVisitByFile);
}
/**
 * Update global variable `$config` and replace variables when needed.
 */
function assignConfig(): void {
	$config = JSON.parse(JSON.stringify(workspace.getConfiguration().get(Constants.ExtensionSettingsPrefix) as ExtensionConfig));

	$state.defaultFilePerWorkspace = false;
	$state.defaultFileDoesntExist = false;
	$state.defaultFileReplacedValue = '';
	$state.defaultArchiveFileReplacedValue = '';

	try {
		if ($config.defaultFile && typeof $config.defaultFile === 'string' && $config.defaultFile.includes(Constants.WorkspaceFolderVariable)) {
			$state.defaultFilePerWorkspace = true;

			const workspaceFolder = workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				$config.defaultFile = '';
			} else {
				$config.defaultFile = path.normalize($config.defaultFile.replace(Constants.WorkspaceFolderVariable, workspaceFolder.uri.fsPath));
				$state.defaultFileReplacedValue = $config.defaultFile;

				if (!fs.existsSync($config.defaultFile)) {
					$state.defaultFileDoesntExist = true;
					console.warn(`${$config.defaultFile} "todomd.defaultFile" doesn't exist.`);
					$config.defaultFile = '';
				}
			}
		}
	} catch (error) {
		console.error('Error while processing workspace folder variable:', error);
		$config.defaultFile = '';
		$state.defaultFileDoesntExist = true;
	}

	try {
		if ($config.defaultArchiveFile && typeof $config.defaultArchiveFile === 'string' && $config.defaultArchiveFile.includes(Constants.WorkspaceFolderVariable)) {
			const workspaceFolder = workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				$config.defaultArchiveFile = '';
			} else {
				$config.defaultArchiveFile = path.normalize($config.defaultArchiveFile.replace(Constants.WorkspaceFolderVariable, workspaceFolder.uri.fsPath));
				$state.defaultArchiveFileReplacedValue = $config.defaultArchiveFile;
			}
		}
	} catch (error) {
		console.error('Error while processing archive file workspace folder variable:', error);
		$config.defaultArchiveFile = '';
	}
}

export function deactivate() {
	disposeEditorDisposables();
	disposeCompletionProviders();
	disposeHover();
	disposeDocumentHighlights();
	disposeRenameProvider();
	disposeReferenceProvider();
	disposeActiveEditorChange();
}
