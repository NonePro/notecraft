import { TreeItemSortType } from '../types';
import { toggleGlobalSetting } from '../utils/vscodeUtils';

export function toggleContextsTreeViewSorting() {
	toggleGlobalSetting('notecraft.sortContextsView', [TreeItemSortType.Alphabetic, TreeItemSortType.Count]);
}
