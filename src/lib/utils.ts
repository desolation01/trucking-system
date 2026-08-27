/**
 * Utility classname joiner — filters out falsy values and joins with space.
 * Shared between ui.tsx and toast.tsx to avoid circular dependency issues.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}