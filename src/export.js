/**
 * Estimate export/import serialization (pure).
 *
 * Produces a versioned JSON envelope for a workload, a CSV of the estimate's
 * line items, and human-readable filenames. Import validation is defensive:
 * it accepts either a full envelope or a bare workload, and never throws.
 */

import { normalizeWorkload } from './state.js';

export const EXPORT_VERSION = 1;
const APP_ID = 'cloud-cost-calculator';

/** Build the export envelope for a workload. */
export function toExportObject(workload, name) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  return {
    app: APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    ...(cleanName ? { name: cleanName } : {}),
    workload: normalizeWorkload(workload),
  };
}

/** Pretty-printed JSON string of the export envelope. */
export function toJson(workload, name) {
  return JSON.stringify(toExportObject(workload, name), null, 2);
}

/**
 * Parse and validate an imported JSON string.
 * Accepts a full envelope ({ workload }) or a bare workload ({ services }).
 * Returns { ok, workload, name } or { ok: false, error }.
 */
export function parseImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'That file is not a valid estimate.' };
  }
  const source =
    parsed.workload && typeof parsed.workload === 'object'
      ? parsed.workload
      : parsed.services && typeof parsed.services === 'object'
        ? parsed
        : null;
  if (!source || typeof source.services !== 'object') {
    return { ok: false, error: 'That file does not contain a workload.' };
  }
  return {
    ok: true,
    workload: normalizeWorkload(source),
    name: typeof parsed.name === 'string' ? parsed.name : undefined,
  };
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV of the estimate's per-service line items plus a total row. */
export function toCsv(estimate) {
  const rows = [['Service', 'Detail', 'Monthly (USD)']];
  estimate.lineItems.forEach((item) => {
    rows.push([item.serviceLabel, item.detail, item.amount.toFixed(2)]);
  });
  rows.push(['Total', '', estimate.total.toFixed(2)]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Build a human-readable, filesystem-safe filename. */
export function buildFilename(base, extension) {
  const slug =
    String(base ?? 'estimate')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'estimate';
  const date = new Date().toISOString().slice(0, 10);
  return `cloud-cost-${slug}-${date}.${extension}`;
}
