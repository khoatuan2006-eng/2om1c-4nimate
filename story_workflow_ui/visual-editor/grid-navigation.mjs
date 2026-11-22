// Bound navigation to real items, including an incomplete final row.
export function gridTarget(key, index, count, columns = 1) {
  if (!Number.isInteger(index) || index < 0 || index >= count || !Number.isInteger(columns) || columns < 1) return null;
  switch (key) {
    case 'Home': return 0;
    case 'End': return count - 1;
    case 'ArrowLeft': return Math.max(0, index - 1);
    case 'ArrowRight': return Math.min(count - 1, index + 1);
    case 'ArrowUp': return Math.max(0, index - columns);
    case 'ArrowDown': return Math.min(count - 1, index + columns);
    default: return null;
  }
}
