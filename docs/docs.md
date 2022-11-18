<!-- TOC -->

- [Filter](#filter)
    - [By default filter applied as case-insensitive text search](#by-default-filter-applied-as-case-insensitive-text-search)
    - [Filter uses AND logic](#filter-uses-and-logic)
- [Set due date helper function `todomd.setDueDate`](#set-due-date-helper-function-todomdsetduedate)
    - [Syntax](#syntax)
    - [Set due date with autocomplete](#use-set-due-date-helper-with-autocomplete)
- [Advanced editor decorations](#advanced-editor-decorations)
- [Webview](#webview)
    - [Tasks are rendered as markdown](#tasks-are-rendered-as-markdown)
    - [Webview Hotkeys](#webview-hotkeys)
    - [Button link](#button-link)
    - [Command Uri](#command-uri)
    - [File Uri](#file-uri)
    - [App Uri](#app-uri)
    - [Highlight specific tags](#highlight-specific-tags)

<!-- /TOC -->

## Filter

### By default filter applied as case-insensitive text search

![filter_demo](https://raw.githubusercontent.com/usernamehw/vscode-todo-md/master/docs/img/filter.png)

### Filter uses AND logic

For instance, filter `#html #css` will only return items containing both tags (1 and 4)

```
1 #html #css
2 #html
3 #css
4 #css #html #js
```

![filter_demo](https://raw.githubusercontent.com/usernamehw/vscode-todo-md/master/docs/img/filter_and_logic.png)

## Set due date helper function `todomd.setDueDate`

### Syntax

example | description
--- | ---
`+0`|today (plus needed)
`+1`|tomorrow
`-1`|yesterday
`+1d`|tomorrow
`+1w`|in one week
`-1w`|one week ago
`+1m`|in one month
`-1m`|one month ago
`0`|last day of the month
`20`|closest future 20th date. If current date is <= 20, then it would be 20th of the current month. Otherwise, 20th of the next month.
`this week`|This week date (depends on `todomd.setDueDateThisWeekDay` setting)
`next week`|Next week date (depends on `todomd.setDueDateNextWeekDay` setting)
`fri` or `friday`|closest future friday.
`nov 20` or `november 20`|closest future 20th of November.
`e3d`|every 3 days with today as a starting date

### Use set due date helper with autocomplete

It's also possible to set due date by typing `$` at the end of the word of the future date:

1. Type the relative date
1. Trigger suggest `editor.action.triggerSuggest`
1. Accept the suggestion

```
+10$
```

## Advanced editor decorations

It's possible to tweak some of the editor decorations with `todomd.decorations` setting.

Example: use background and gutter icon for completed task:

```js
"todomd.decorations": {
	"completedTask": {
		"backgroundColor": "#80e73c10",
		"overviewRulerColor": "#80e73caa",
		"gutterIconPath": "C:/icons/check.png",
		"gutterIconSize": "20px",
	},
}
```

![completed_task_gif](./img/completed_task_decoration.gif)

Change appearance of a chosen project/tag/context:

```js
"todomd.decorations": {
	"#important": {
		"color": "#ff000080",
		"fontWeight": "bold"
	},
},
```

![advanced_decoration_specific_tag](./img/advanced_decoration_specific_tag.png)

## Webview

### Tasks are rendered as markdown

Treating each line as a separate markdown line (no multi-line features).

```
<kbd>Ctrl</kbd>+<kbd>Enter</kbd>
Some text <mark>Important</mark> text text text
**BOLD** *italic* `inline code`
A markdown link [GitHub](https://github.com)
<span style="display:inline-block;background:linear-gradient(0.25turn,#3f87a6,#ebf8e1,#f69d3c);color:#fff;padding:0.5rem;border-radius:3px;font-style:bold;">==========</span>
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" preserveAspectRatio="xMidYMid"><path d="M191.979 0v219.867L0 191.354l191.979 64.644 64-26.623V30.592l.021-.01-.021-.042v-3.915L191.979 0zm-67.183 37.458L65.994 95.583 30.592 68.921l-14.59 4.873 36.017 35.604L16.002 145l14.59 4.875 35.402-26.663h.002l58.798 58.121 35.217-14.963V52.421l-35.215-14.963zm-.002 41.473v60.927L84.34 109.394l40.454-30.463z" fill="#016ec5"/></svg> Inline svg icon
Image: <br> <img width="100" height="100" src="https://unsplash.it/200/200">
```

![webview renders markdown demo](https://raw.githubusercontent.com/usernamehw/vscode-todo-md/master/docs/img/webview_markdown.png)

### Webview Hotkeys

Key | Description
--- | ---
<kbd>↓</kbd>|Select next task
<kbd>↑</kbd>|Select previous task
<kbd>→</kbd>|Toggle collapsing of nested tasks
<kbd>Home</kbd>|Select first task
<kbd>End</kbd>|Select last task
<kbd>Insert</kbd>|Add new task to root
<kbd>Ctrl</kbd>+<kbd>Insert</kbd>|Add new task as a subtask to selected task
<kbd>Shift</kbd>+<kbd>Delete</kbd>|Delete selected task
<kbd>Alt</kbd>+<kbd>D</kbd>|Toggle selected task completion
<kbd>F2</kbd>|Edit selected task title
<kbd>Ctrl</kbd>+<kbd>Space</kbd>|Open autocomplete (When `todomd.webview.autoShowSuggest` is disabled)
<kbd>Alt</kbd> + <kbd>L Mouse Button</kbd> (on a task)|Reveals task in the file
<kbd>L Mouse Button</kbd> (on tag/project/context)|Set filter to the value of the item
<kbd>Ctrl</kbd> + <kbd>L Mouse Button</kbd> (on tag/project/context)|Append item value to the filter
<kbd>Alt</kbd> + <kbd>L Mouse Button</kbd> on twistie (folding icon)|Collapse/uncollapse all nested tasks

### Button link

Just a link styled like a button.

```md
[btn:Google](https://www.google.com)
```

### Command Uri

You can make links that execute vscode commands:

```md
[Open Settings](command:workbench.action.openSettings2)
```

Also with arguments:

```md
[Open Workbench Settings](command:workbench.action.openSettings?%22workbench%22)
```

> Arguments should be encoded: `encodeURIComponent(JSON.stringify(args))`

https://code.visualstudio.com/api/extension-guides/command#command-uris

### File Uri

File scheme will open file in VSCode:

```md
[Config File](file:///C:config/config.txt)
```

### App Uri

App scheme will open file in default app:

```md
[Open image preview](app:///C:/temp/img.png)
```

### Highlight specific tags

From Settings:

```js
"todomd.webview.tagStyles": {
    "important": {
        "backgroundColor": "#ff5151",
        "color": "#fff",
        "border": "1px solid #000000"
    }
}
```

![Custom tag style in webview](./img/webview_tag_style.png)