import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateWorkload, serviceLabel } from '../src/calculator.js';
import {
  createDefaultWorkload,
  countEnabledServices,
  normalizeWorkload,
  presetWorkload,
  setBudget,
} from '../src/state.js';
import { compareEstimates } from '../src/compare.js';
import { toJson, parseImport } from '../src/export.js';
import { encodeState, decodeState } from '../src/share.js';
import { saveScenario, loadScenarios } from '../src/scenarios.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

// A fully populated workload with every service enabled and known numbers.
function fullWorkload() {
  return normalizeWorkload({
    region: 'us-east-1',
    budget: 200,
    services: {
      ec2: { enabled: true, instanceType: 't3.medium', quantity: 2, hours: 730, rate: 0.0416 },
      ebs: { enabled: true, volumeType: 'gp3', volumes: 2, sizeGb: 50, rate: 0.08 },
      s3: { enabled: true, storageClass: 'standard', storageGb: 100, rate: 0.023, requests: 1_000_000, requestRate: 0.0004 },
      rds: { enabled: true, engine: 'postgres', instanceClass: 'db.t3.small', quantity: 1, hours: 730, instanceRate: 0.034, storageGb: 50, storageRate: 0.115 },
      dataTransfer: { enabled: true, outboundGb: 200, rate: 0.09 },
    },
  });
}

describe('complete estimation workflow', () => {
  it('sums every enabled service into a consistent total', () => {
    const estimate = estimateWorkload(fullWorkload());

    const subtotalSum = Object.values(estimate.serviceSubtotals).reduce((a, b) => a + b, 0);
    assert.equal(Number(subtotalSum.toFixed(6)), Number(estimate.total.toFixed(6)));

    const lineItemSum = estimate.lineItems.reduce((a, item) => a + item.amount, 0);
    assert.equal(Number(lineItemSum.toFixed(6)), Number(estimate.total.toFixed(6)));

    // five services -> at least seven line items (ec2, ebs, s3 storage+requests, rds instance+storage, transfer)
    assert.equal(estimate.lineItems.length, 7);
    assert.equal(countEnabledServices(fullWorkload()), 5);
  });

  it('keeps budget metrics internally consistent', () => {
    const estimate = estimateWorkload(fullWorkload());
    assert.equal(estimate.annualTotal, estimate.total * 12);
    assert.equal(estimate.remaining, estimate.budget - estimate.total);
    assert.equal(estimate.overage, Math.max(0, estimate.total - estimate.budget));
    if (estimate.budget > 0) {
      assert.equal(estimate.budgetUsedPercent, (estimate.total / estimate.budget) * 100);
    }
  });

  it('labels every service and stays safe for unknown ids', () => {
    for (const id of ['ec2', 'ebs', 's3', 'rds', 'dataTransfer']) {
      assert.equal(typeof serviceLabel(id), 'string');
      assert.ok(serviceLabel(id).length > 0);
    }
    assert.equal(serviceLabel('mystery'), 'mystery');
  });

  it('recomputes budget status when the budget changes', () => {
    const cheap = setBudget(fullWorkload(), 100000);
    assert.equal(estimateWorkload(cheap).budgetStatus, 'healthy');
    const tight = setBudget(fullWorkload(), 1);
    assert.equal(estimateWorkload(tight).budgetStatus, 'over');
  });
});

describe('cross-module round-trips preserve the estimate', () => {
  it('survives JSON export then import', () => {
    const workload = fullWorkload();
    const before = estimateWorkload(workload).total;
    const result = parseImport(toJson(workload, 'Full'));
    assert.equal(result.ok, true);
    assert.equal(estimateWorkload(result.workload).total, before);
  });

  it('survives share encode then decode', () => {
    const workload = fullWorkload();
    const before = estimateWorkload(workload).total;
    const decoded = decodeState(encodeState(workload));
    assert.equal(estimateWorkload(decoded).total, before);
  });

  it('survives a scenario save then load', () => {
    const storage = memoryStorage();
    const workload = fullWorkload();
    const before = estimateWorkload(workload).total;
    saveScenario(storage, 'Full workload', workload);
    const [scenario] = loadScenarios(storage);
    assert.equal(estimateWorkload(scenario.workload).total, before);
  });
});

describe('comparison over the full workflow', () => {
  it('reports equality when comparing an estimate with itself', () => {
    const estimate = estimateWorkload(fullWorkload());
    const result = compareEstimates(estimate, estimate);
    assert.equal(result.cheaper, 'equal');
    assert.equal(result.monthlyDiff, 0);
    assert.ok(result.services.every((row) => row.diff === 0));
  });

  it('detects the cheaper of two presets', () => {
    const dev = estimateWorkload(presetWorkload('dev', 'us-east-1'));
    const heavy = estimateWorkload(presetWorkload('data-heavy', 'us-east-1'));
    const result = compareEstimates(heavy, dev); // active = heavy, other = dev
    assert.equal(result.cheaper, 'other');
    assert.ok(result.monthlyDiff < 0);
  });
});

describe('resilience across the pipeline', () => {
  it('never throws and yields a zero estimate for corrupt input', () => {
    for (const bad of [null, undefined, 'garbage', 42, [], { services: 'nope' }]) {
      assert.doesNotThrow(() => estimateWorkload(bad));
      assert.equal(estimateWorkload(bad).total, 0);
    }
  });

  it('treats a corrupt share token as absent', () => {
    assert.equal(decodeState('%%%not-base64%%%'), null);
    assert.equal(estimateWorkload(decodeState('') ?? createDefaultWorkload()).total > 0, true);
  });
});
