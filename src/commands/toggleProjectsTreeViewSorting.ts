import { TreeItemSortType } from '../types';
import { toggleGlobalSetting } from '../utils/vscodeUtils';

export function toggleProjectsTreeViewSorting() {
	toggleGlobalSetting('notecraft.sortProjectsView', [TreeItemSortType.Alphabetic, TreeItemSortType.Count]);
}
