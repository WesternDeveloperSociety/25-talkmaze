/**
 * Combines first and last name into a single trimmed string.
 * @param first - First name, may be null or undefined.
 * @param last - Last name, may be null or undefined.
 * @param fallback - Returned when both names are empty. Defaults to "".
 * @returns Trimmed full name, or `fallback` if the result would be empty.
 */
export function fullName(
  first: string | null | undefined,
  last: string | null | undefined,
  fallback = "",
): string {
  return `${first ?? ""} ${last ?? ""}`.trim() || fallback;
}

/**
 * Derives uppercase initials from a name for avatar fallbacks.
 * @param name - Full name (e.g. "Priya Sharma"). May be empty.
 * @param max - Maximum number of initials to return. Defaults to 2.
 * @returns Up to `max` uppercase initials, or "" when `name` is empty.
 */
export function initials(name: string | null | undefined, max = 2): string {
  return (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
