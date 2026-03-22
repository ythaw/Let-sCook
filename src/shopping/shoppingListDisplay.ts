/** Title-case words for list UI from canonical stored name. */
export function formatShoppingItemDisplay(canonicalName: string): string {
  return canonicalName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
