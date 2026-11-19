// Cursor handling shared by every paginated call.
//
// The API returns its next-page cursor as `end_cursor` (usually inside a
// `page_info` block next to `has_next_page`). Where exactly it sits differs by
// endpoint, so we look for it instead of hard-coding a path, and stop as soon
// as there is no cursor, `has_next_page` is false, or a cursor repeats.

// Our own envelope around every answer: never data, never a cursor.
export const ENVELOPE_KEYS = ["meta", "message"];

const STOP = Symbol("stop");

function findCursor(node, depth) {
  if (depth > 4 || !node || typeof node !== "object" || Array.isArray(node)) return null;
  const info = node.page_info;
  if (info && typeof info === "object") {
    if (info.has_next_page === false) return STOP;
    if (typeof info.end_cursor === "string" && info.end_cursor) return info.end_cursor;
  }
  if (typeof node.end_cursor === "string" && node.end_cursor) return node.end_cursor;
  for (const [key, value] of Object.entries(node)) {
    if (ENVELOPE_KEYS.includes(key)) continue;
    const found = findCursor(value, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

/** The cursor for the next page, or null when there is no next page. */
export function nextCursor(body) {
  const found = findCursor(body, 0);
  return typeof found === "string" ? found : null;
}

/**
 * Call `fetchPage(cursor)` up to `pages` times, yielding each answer.
 * Every call is a billed API call, so `pages` is a hard ceiling.
 */
export async function* paginate(fetchPage, pages) {
  if (!Number.isInteger(pages) || pages < 1) throw new RangeError("pages must be a whole number, 1 or more");
  let cursor = null;
  const seen = new Set();
  for (let i = 0; i < pages; i++) {
    const body = await fetchPage(cursor);
    yield body;
    cursor = nextCursor(body);
    if (cursor === null || seen.has(cursor)) return;
    seen.add(cursor);
  }
}
