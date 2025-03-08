import { commands } from 'vscode';
import { focusWebviewFilterInput } from '../webview/webviewView';

export async function focusTasksWebviewAndInput(args: { selectInputText?: boolean; fillInputValue?: string }) {
	await commands.executeCommand('notecraft.webviewTasks.focus');
	await commands.executeCommand('notecraft.webviewTasks.focus');
	await commands.executeCommand('notecraft.webviewTasks.focus');

	focusWebviewFilterInput({
		selectInputText: args?.selectInputText,
		fillInputValue: args?.fillInputValue,
	});
}
