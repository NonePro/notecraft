import { Disposable, languages, Position, Range, WorkspaceEdit } from 'vscode';
import { ParsedWordContext, ParsedWordProject, ParsedWordTags, parseWord } from '../parse';
import { forEachTask } from '../utils/taskUtils';
import { getWordRangeAtPosition } from '../utils/vscodeUtils';
import { getNotecraftFileDocumentSelector } from './languageFeatures';

let renameProviderDisposable: Disposable | undefined;

export function disposeRenameProvider() {
	renameProviderDisposable?.dispose();
}

export function updateRenameProvider() {
	disposeRenameProvider();

	renameProviderDisposable = languages.registerRenameProvider(
		getNotecraftFileDocumentSelector(),
		{
			provideRenameEdits(document, position, newName) {
				const range = getWordRangeAtPosition(document, position);
				if (!range) {
					return undefined;
				}
				const word = document.getText(range);
				const parsedWord = parseWord(word, position.line, range.start.character);
				if (parsedWord.type === 'tags') {
					const allTagRanges = getAllTagRangesInDocument(parsedWord, position);
					const edit = new WorkspaceEdit();
					newName = newName[0] === '#' ? newName : `#${newName}`;
					for (const tagRange of allTagRanges) {
						edit.replace(document.uri, tagRange, newName);
					}
					return edit;
				} else if (parsedWord.type === 'project') {
					const allProjectRanges = getAllProjectRangesInDocument(parsedWord, position);
					const edit = new WorkspaceEdit();
					newName = newName[0] === '+' ? newName : `+${newName}`;
					for (const projectRange of allProjectRanges) {
						edit.replace(document.uri, projectRange, newName);
					}
					return edit;
				} else if (parsedWord.type === 'context') {
					const allContextRanges = getAllContextRangesInDocument(parsedWord, position);
					const edit = new WorkspaceEdit();
					newName = newName[0] === '@' ? newName : `@${newName}`;
					for (const projectRange of allContextRanges) {
						edit.replace(document.uri, projectRange, newName);
					}
					return edit;
				}
				return undefined;
			},
			// async prepareRename(document, position) {// Not worth it
			// 	const range = getWordRangeAtPosition(document, position);
			// 	if (!range) {
			// 		return undefined;
			// 	}
			// 	const word = document.getText(range);
			// 	const parsedWord = parseWord(word, position.line, range.start.character);
			// 	if (parsedWord.type !== 'tags' && parsedWord.type !== 'project' && parsedWord.type !== 'context') {
			// 		return Promise.reject('You cannot rename this element');
			// 	}
			// 	return {
			// 		range,
			// 		placeholder: word.slice(1),
			// 	};
			// },
		},
	);
}


export function getAllTagRangesInDocument(tag: ParsedWordTags, position: Position): Range[] {
	if (tag.range.contains(position)) {
		const documentRanges: Range[] = [];
		forEachTask(task => {
			const index = task.tags.indexOf(tag.value);
			if (index !== -1) {
				documentRanges.push(task.tagsRange![index]);
			}
		});
		return documentRanges;
	}
	return [];
}
export function getAllContextRangesInDocument(context: ParsedWordContext, position: Position): Range[] {
	if (context.range.contains(position)) {
		const documentRanges: Range[] = [];
		forEachTask(task => {
			const index = task.contexts.indexOf(context.value);
			if (index !== -1) {
				documentRanges.push(task.contextRanges[index]);
			}
		});
		return documentRanges;
	}
	return [];
}
export function getAllProjectRangesInDocument(project: ParsedWordProject, position: Position): Range[] {
	if (project.range.contains(position)) {
		const documentRanges: Range[] = [];
		forEachTask(task => {
			const index = task.projects.indexOf(project.value);
			if (index !== -1) {
				documentRanges.push(task.projectRanges[index]);
			}
		});
		return documentRanges;
	}
	return [];
}
