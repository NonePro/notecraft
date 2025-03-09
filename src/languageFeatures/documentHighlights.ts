import { Disposable, DocumentHighlight, DocumentHighlightKind, languages, Range } from 'vscode';
import { parseWord } from '../parse';
import { getWordRangeAtPosition } from '../utils/vscodeUtils';
import { getNotecraftFileDocumentSelector } from './languageFeatures';
import { getAllContextRangesInDocument, getAllProjectRangesInDocument, getAllTagRangesInDocument } from './renameProvider';

let documentHighlightsDisposable: Disposable | undefined;

export function disposeDocumentHighlights() {
	documentHighlightsDisposable?.dispose();
}

export function updateDocumentHighlights() {
	disposeDocumentHighlights();

	documentHighlightsDisposable = languages.registerDocumentHighlightProvider(
		getNotecraftFileDocumentSelector(),
		{
			provideDocumentHighlights(document, position) {
				const wordRange = getWordRangeAtPosition(document, position);
				if (!wordRange) {
					return [];
				}
				const wordText = document.getText(wordRange);
				const word = parseWord(wordText, position.line, wordRange.start.character);

				let resultRanges: Range[] = [];

				if (word.type === 'tags') {
					resultRanges = getAllTagRangesInDocument(word, position);
				} else if (word.type === 'context') {
					resultRanges = getAllContextRangesInDocument(word, position);
				} else if (word.type === 'project') {
					resultRanges = getAllProjectRangesInDocument(word, position);
				}
				return resultRanges.map(range => new DocumentHighlight(range, DocumentHighlightKind.Read));
			},
		},
	);
}

