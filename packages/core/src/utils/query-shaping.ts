// ─── Query Shaping Utilities ────────────────────────────────────────

const MAX_FIELDS = 50;
const MAX_INCLUDES = 10;
const DEFAULT_MAX_DEPTH = 3;

/**
 * Parse a comma-separated `fields` query parameter into an array of
 * field names.  Returns undefined when the param is empty/absent so
 * callers can treat undefined as "return all fields".
 *
 * Limits to 50 fields maximum to prevent abuse.
 */
export function parseFields(param: string | undefined): string[] | undefined {
  if (!param || param.trim().length === 0) return undefined;

  const fields = param
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  if (fields.length === 0) return undefined;

  return fields.slice(0, MAX_FIELDS);
}

/**
 * Parse a comma-separated `include` query parameter into an array of
 * include keys.  Limits to 10 includes maximum and validates that no
 * individual include exceeds the depth limit (default 3).
 */
export function parseInclude(param: string | undefined): string[] {
  if (!param || param.trim().length === 0) return [];

  const includes = param
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  if (includes.length === 0) return [];

  // Enforce max includes
  const bounded = includes.slice(0, MAX_INCLUDES);

  // Drop any includes that exceed the default max depth
  return bounded.filter((inc) => {
    const depth = inc.split('.').length;
    return depth <= DEFAULT_MAX_DEPTH;
  });
}

/**
 * Project only the requested fields from a data object.
 * Returns the full object when `fields` is undefined or empty.
 */
export function projectFields(
  data: Record<string, unknown>,
  fields?: string[],
): Record<string, unknown> {
  if (!fields || fields.length === 0) return data;

  const result: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in data) {
      result[key] = data[key];
    }
  }
  return result;
}

/**
 * Validate that no include path exceeds the specified max depth.
 * Depth is measured by the number of dot-separated segments.
 *
 * Returns true when all includes are within bounds, false otherwise.
 */
export function validateIncludeDepth(include: string[], maxDepth: number): boolean {
  return include.every((inc) => inc.split('.').length <= maxDepth);
}
