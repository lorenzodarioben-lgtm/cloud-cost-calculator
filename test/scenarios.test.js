import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  SCENARIO_STORE_VERSION,
  deleteScenario,
  loadScenarios,
  readStore,
  renameScenario,
  saveScenario,
} from '../src/scenarios.js';
import { createDefaultWorkload } from '../src/state.js';

function memoryStorage(seed) {
  const map = new Map();
  if (seed !== undefined) {
    map.set('cloud-cost-calculator-scenarios', seed);
  }
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

describe('scenario storage', () => {
  let storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('starts empty', () => {
    assert.deepEqual(loadScenarios(storage), []);
  });

  it('saves and reloads a scenario', () => {
    saveScenario(storage, 'Baseline', createDefaultWorkload());
    const scenarios = loadScenarios(storage);
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].name, 'Baseline');
    assert.equal(scenarios[0].workload.services.ec2.enabled, true);
  });

  it('persists a versioned envelope', () => {
    saveScenario(storage, 'Baseline', createDefaultWorkload());
    assert.equal(readStore(storage).version, SCENARIO_STORE_VERSION);
  });

  it('upserts by name instead of duplicating', () => {
    saveScenario(storage, 'Prod', createDefaultWorkload());
    const workload = createDefaultWorkload();
    workload.budget = 999;
    saveScenario(storage, 'prod', workload); // case-insensitive match
    const scenarios = loadScenarios(storage);
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].workload.budget, 999);
  });

  it('ignores empty names', () => {
    saveScenario(storage, '   ', createDefaultWorkload());
    assert.equal(loadScenarios(storage).length, 0);
  });

  it('deletes by id', () => {
    saveScenario(storage, 'A', createDefaultWorkload());
    saveScenario(storage, 'B', createDefaultWorkload());
    const [first] = loadScenarios(storage);
    deleteScenario(storage, first.id);
    const remaining = loadScenarios(storage).map((scenario) => scenario.name);
    assert.equal(remaining.includes(first.name), false);
  });

  it('renames by id and ignores empty names', () => {
    saveScenario(storage, 'Old', createDefaultWorkload());
    const [scenario] = loadScenarios(storage);
    renameScenario(storage, scenario.id, 'New');
    assert.equal(loadScenarios(storage)[0].name, 'New');
    renameScenario(storage, scenario.id, '  ');
    assert.equal(loadScenarios(storage)[0].name, 'New');
  });
});

describe('scenario resilience', () => {
  it('recovers from corrupt JSON', () => {
    const storage = memoryStorage('{ this is not json');
    assert.deepEqual(loadScenarios(storage), []);
  });

  it('drops invalid entries but keeps valid ones', () => {
    const payload = JSON.stringify({
      version: 1,
      scenarios: [
        { name: 'Good', workload: createDefaultWorkload() },
        { name: '', workload: {} },
        { workload: createDefaultWorkload() },
        'garbage',
        42,
      ],
    });
    const storage = memoryStorage(payload);
    const scenarios = loadScenarios(storage);
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].name, 'Good');
  });

  it('salvages a legacy bare-array payload', () => {
    const payload = JSON.stringify([{ name: 'Legacy', workload: createDefaultWorkload() }]);
    const storage = memoryStorage(payload);
    const scenarios = loadScenarios(storage);
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].name, 'Legacy');
  });
});
