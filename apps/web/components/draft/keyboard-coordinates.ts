import type { KeyboardCoordinateGetter } from '@dnd-kit/core';

export function nextSlotIndex(current: number, key: string, count: number): number | undefined {
  if (count === 0) return undefined;
  if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(key)) return undefined;
  if (current < 0) return 0;

  const direction = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1;
  return Math.min(Math.max(current + direction, 0), count - 1);
}

export const slotKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const containers = [...context.droppableContainers.getEnabled()].sort((left, right) => {
    const leftNode = left.node.current;
    const rightNode = right.node.current;
    if (leftNode === null || rightNode === null) return 0;
    const position = leftNode.compareDocumentPosition(rightNode);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  const currentIndex = containers.findIndex((container) => container.id === context.over?.id);
  const nextIndex = nextSlotIndex(currentIndex, event.key, containers.length);
  if (nextIndex === undefined) return undefined;

  const container = containers[nextIndex];
  if (container === undefined) return undefined;
  container.node.current?.scrollIntoView({ block: 'nearest' });
  const rect = context.droppableRects.get(container.id);
  if (rect === undefined) return undefined;
  return { x: rect.left, y: rect.top };
};
