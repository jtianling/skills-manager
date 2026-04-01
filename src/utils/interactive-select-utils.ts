export interface SelectChoice {
  name: string;
  description?: string;
  value: string;
  checked?: boolean;
  locked?: boolean;
  group?: string;
  subGroup?: string;
  innerGroup?: string;
  suffix?: string;
  selectedSuffix?: string;
}

export interface DisplayItem {
  type: 'separator' | 'choice' | 'group-header' | 'inner-group-header';
  text?: string;
  choiceIndex?: number;
  childIndices?: number[];
  subGroupName?: string;
  innerGroupName?: string;
  parentSubGroup?: string;
}

export type GroupState = 'all' | 'partial' | 'none';

export function getGroupState(childIndices: number[], selected: Set<number>): GroupState {
  if (childIndices.length === 0) return 'none';
  let selectedCount = 0;
  for (const idx of childIndices) {
    if (selected.has(idx)) selectedCount++;
  }
  if (selectedCount === 0) return 'none';
  if (selectedCount === childIndices.length) return 'all';
  return 'partial';
}

export function getInnerGroupKey(subGroupName: string, innerGroupName: string): string {
  return `${subGroupName}/${innerGroupName}`;
}

export function isFocusable(item: DisplayItem): boolean {
  return (
    item.type === 'choice'
    || item.type === 'group-header'
    || item.type === 'inner-group-header'
  );
}

export function isHeaderItem(
  item: DisplayItem | undefined,
): item is DisplayItem & { type: 'group-header' | 'inner-group-header' } {
  return item !== undefined
    && (item.type === 'group-header' || item.type === 'inner-group-header');
}

function sortedChoiceIndices(choices: SelectChoice[]): number[] {
  const indices = choices.map((_, i) => i);
  return indices.sort((a, b) => {
    const ca = choices[a];
    const cb = choices[b];
    if (ca.group !== cb.group) return 0;
    if (ca.subGroup !== cb.subGroup) return 0;
    const igA = ca.innerGroup ?? '';
    const igB = cb.innerGroup ?? '';
    if (igA === '' && igB !== '') return 1;
    if (igA !== '' && igB === '') return -1;
    if (igA !== igB) return igA.localeCompare(igB);
    return 0;
  });
}

export function buildDisplayItems(
  choices: SelectChoice[],
  searchQuery: string,
  collapsed: Set<string> = new Set<string>(),
  innerCollapsed: Set<string> = new Set<string>(),
): { displayItems: DisplayItem[]; filteredIndices: number[] } {
  const displayItems: DisplayItem[] = [];
  const filteredIndices: number[] = [];
  const childIndicesByHeader = new Map<number, number[]>();
  let currentGroup: string | undefined;
  let currentSubGroup: string | undefined;
  let currentInnerGroup: string | undefined;
  let currentGroupHeaderIndex: number | undefined;
  let currentInnerGroupHeaderIndex: number | undefined;
  const normalizedQuery = searchQuery.toLowerCase();
  const iterOrder = sortedChoiceIndices(choices);

  iterOrder.forEach((index) => {
    const choice = choices[index];
    if (searchQuery && !choice.name.toLowerCase().includes(normalizedQuery)) {
      return;
    }

    filteredIndices.push(index);

    if (choice.group !== undefined && choice.group !== currentGroup) {
      currentGroup = choice.group;
      currentSubGroup = undefined;
      currentInnerGroup = undefined;
      currentGroupHeaderIndex = undefined;
      currentInnerGroupHeaderIndex = undefined;
      displayItems.push({ type: 'separator', text: `── ${choice.group} ──` });
    }

    if (choice.subGroup !== currentSubGroup) {
      currentSubGroup = choice.subGroup;
      currentInnerGroup = undefined;
      currentInnerGroupHeaderIndex = undefined;
      if (choice.subGroup !== undefined) {
        currentGroupHeaderIndex = displayItems.push({
          type: 'group-header',
          subGroupName: choice.subGroup,
        }) - 1;
      } else {
        currentGroupHeaderIndex = undefined;
      }
    }

    const isPlaceholder = choice.value.startsWith('__empty_');

    if (currentGroupHeaderIndex !== undefined && choice.subGroup !== undefined) {
      if (!isPlaceholder) {
        const childIndices = childIndicesByHeader.get(currentGroupHeaderIndex) ?? [];
        childIndicesByHeader.set(currentGroupHeaderIndex, [...childIndices, index]);
      }
      if (collapsed.has(choice.subGroup)) {
        return;
      }
    }

    if (isPlaceholder) return;

    if (choice.subGroup !== undefined) {
      if (choice.innerGroup !== currentInnerGroup) {
        currentInnerGroup = choice.innerGroup;
        if (choice.innerGroup !== undefined) {
          currentInnerGroupHeaderIndex = displayItems.push({
            type: 'inner-group-header',
            innerGroupName: choice.innerGroup,
            parentSubGroup: choice.subGroup,
          }) - 1;
        } else {
          currentInnerGroupHeaderIndex = undefined;
        }
      }
    } else {
      currentInnerGroup = undefined;
      currentInnerGroupHeaderIndex = undefined;
    }

    if (
      currentInnerGroupHeaderIndex !== undefined
      && choice.subGroup !== undefined
      && choice.innerGroup !== undefined
    ) {
      const childIndices = childIndicesByHeader.get(currentInnerGroupHeaderIndex) ?? [];
      childIndicesByHeader.set(currentInnerGroupHeaderIndex, [...childIndices, index]);
      if (innerCollapsed.has(getInnerGroupKey(choice.subGroup, choice.innerGroup))) {
        return;
      }
    }

    displayItems.push({ type: 'choice', choiceIndex: index });
  });

  return {
    displayItems: displayItems.map((item, itemIndex) => (
      isHeaderItem(item)
        ? { ...item, childIndices: childIndicesByHeader.get(itemIndex) ?? [] }
        : item
    )),
    filteredIndices,
  };
}

export function getDisplayIndexForLineNumber(
  displayItems: DisplayItem[],
  lineNum: number,
): number {
  let count = 0;
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < displayItems.length; i++) {
    if (!isFocusable(displayItems[i])) {
      continue;
    }
    count++;
    if (firstIdx === -1) firstIdx = i;
    lastIdx = i;
    if (count === lineNum) return i;
  }
  if (lineNum <= 0) return firstIdx >= 0 ? firstIdx : 0;
  return lastIdx >= 0 ? lastIdx : 0;
}
