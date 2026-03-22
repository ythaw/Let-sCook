/** Shared with Home header and Profile — derives 1–2 letter initials from a display name. */
export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const a = parts[0][0] ?? '';
  const b =
    parts.length > 1 ? parts[parts.length - 1][0] ?? '' : parts[0][1] ?? '';
  return (a + b).toUpperCase() || '?';
}
