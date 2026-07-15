/**
 * Named scenario storage (versioned, defensive).
 *
 * Scenarios are persisted in Web Storage under a single versioned envelope.
 * Every read is defensive: corrupt JSON, wrong shapes, or a future/older
 * version can never crash the app — the worst case is an empty list. All
 * functions take a Web Storage-like object so they can be unit tested with an
 * in-memory stub.
 */

import { normalizeWorkload } from './state.js';

export const SCENARIO_STORE_VERSION = 1;
const STORAGE_KEY = 'cloud-cost-calculator-scenarios';

function emptyStore() {
  return { version: SCENARIO_STORE_VERSION, scenarios: [] };
}

function makeId() {
  return `scn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Validate and repair a single stored entry; returns null if unusable. */
function sanitizeScenario(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (!name) {
    return null;
  }
  if (!entry.workload || typeof entry.workload !== 'object') {
    return null;
  }
  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : makeId(),
    name,
    savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : new Date(0).toISOString(),
    workload: normalizeWorkload(entry.workload),
  };
}

/**
 * Migrate/repair a parsed envelope into the current shape. Unknown or older
 * versions still have their scenario array salvaged where possible.
 */
function migrate(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return emptyStore();
  }
  const list = Array.isArray(parsed.scenarios)
    ? parsed.scenarios
    : Array.isArray(parsed)
      ? parsed
      : [];
  const scenarios = list.map(sanitizeScenario).filter(Boolean);
  return { version: SCENARIO_STORE_VERSION, scenarios };
}

/** Read the full, sanitized store. Never throws. */
export function readStore(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyStore();
    }
    return migrate(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

function writeStore(storage, store) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage full or unavailable — keep working in-memory */
  }
}

/** List saved scenarios, newest first. Never throws. */
export function loadScenarios(storage) {
  return readStore(storage).scenarios;
}

/**
 * Upsert a scenario by name (case-insensitive). Returns the updated list.
 * An empty name is ignored.
 */
export function saveScenario(storage, name, workload) {
  const cleanName = String(name ?? '').trim();
  if (!cleanName) {
    return loadScenarios(storage);
  }
  const store = readStore(storage);
  const entry = {
    id: makeId(),
    name: cleanName,
    savedAt: new Date().toISOString(),
    workload: normalizeWorkload(workload),
  };
  const existingIndex = store.scenarios.findIndex(
    (scenario) => scenario.name.toLowerCase() === cleanName.toLowerCase(),
  );
  if (existingIndex >= 0) {
    entry.id = store.scenarios[existingIndex].id;
    store.scenarios[existingIndex] = entry;
  } else {
    store.scenarios.unshift(entry);
  }
  writeStore(storage, store);
  return store.scenarios;
}

/** Delete a scenario by id. Returns the updated list. */
export function deleteScenario(storage, id) {
  const store = readStore(storage);
  store.scenarios = store.scenarios.filter((scenario) => scenario.id !== id);
  writeStore(storage, store);
  return store.scenarios;
}

/** Rename a scenario by id. Empty names are ignored. Returns the updated list. */
export function renameScenario(storage, id, name) {
  const cleanName = String(name ?? '').trim();
  if (!cleanName) {
    return loadScenarios(storage);
  }
  const store = readStore(storage);
  const scenario = store.scenarios.find((entry) => entry.id === id);
  if (scenario) {
    scenario.name = cleanName;
    writeStore(storage, store);
  }
  return store.scenarios;
}

/** Look up a single scenario by id, or null. */
export function getScenario(storage, id) {
  return readStore(storage).scenarios.find((scenario) => scenario.id === id) ?? null;
}

/** A Web Storage-like object that degrades to memory if localStorage is unavailable. */
export function resolveStorage() {
  try {
    const probe = '__ccc_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
    };
  }
}
