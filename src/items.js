// Find the records in an answer and flatten them for CSV.
//
// Endpoints wrap their list under different keys (`posts`, `items`, `videos`,
// …), so instead of a per-endpoint path we take the longest list of objects in
// the answer, outside our own `meta` / `message` envelope. The same rule reads
// live answers in the SocialAPIs Google Sheets add-on.

import { ENVELOPE_KEYS } from "./paging.js";

const isRecord = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

function bestList(node, depth) {
  if (depth > 3) return null;
  if (Array.isArray(node)) return node.length && node.every(isRecord) ? node : null;
  if (!isRecord(node)) return null;
  let best = null;
  for (const [key, value] of Object.entries(node)) {
    if (ENVELOPE_KEYS.includes(key)) continue;
    const found = bestList(value, depth + 1);
    if (found && (!best || found.length > best.length)) best = found;
  }
  return best;
}

/** The records of one answer (posts, comments, videos…), or []. */
export function itemsOf(body) {
  return bestList(body, 0) || [];
}

/** A single-record answer without our envelope (and its "0" / data wrapper). */
export function recordOf(body) {
  if (!isRecord(body)) return {};
  for (const key of ["0", "data"]) if (isRecord(body[key])) return body[key];
  return Object.fromEntries(Object.entries(body).filter(([k]) => !ENVELOPE_KEYS.includes(k)));
}

function cell(value) {
  if (value === null || value === undefined) return "";
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value) && value.every((x) => x === null || typeof x !== "object")) {
    return value.filter((x) => x !== null && x !== undefined).join(", ");
  }
  return JSON.stringify(value);
}

/** { a: 1, b: { c: 2 } } → { a: 1, "b.c": 2 } (two levels; deeper parts stay JSON). */
export function flatten(record, prefix = "", depth = 0) {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (isRecord(value) && depth < 2) Object.assign(out, flatten(value, name, depth + 1));
    else out[name] = cell(value);
  }
  return out;
}

function csvCell(value) {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Records → CSV text; the headers are every field seen, in order of first appearance. */
export function toCsv(records) {
  const flat = records.map((r) => flatten(r));
  const headers = [];
  for (const row of flat) for (const k of Object.keys(row)) if (!headers.includes(k)) headers.push(k);
  if (!headers.length) return "(no results)\r\n";
  const lines = [headers.map(csvCell).join(",")];
  for (const row of flat) lines.push(headers.map((h) => csvCell(row[h] ?? "")).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
