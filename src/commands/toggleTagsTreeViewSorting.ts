import { TreeItemSortType } from '../types';
import { toggleGlobalSetting } from '../utils/vscodeUtils';

export function toggleTagsTreeViewSorting() {
	toggleGlobalSetting('notecraft.sortTagsView', [TreeItemSortType.Alphabetic, TreeItemSortType.Count]);
}
