import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateWorkload } from '../src/calculator.js';
import { analyzeDrivers, buildRecommendations } from '../src/recommendations.js';

function workload({ budget = 100, ec2 = {}, ebs = {} } = {}) {
  return {
    budget,
    services: {
      ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 730, rate: 0.0104, ...ec2 },
      ebs: { enabled: true, volumeType: 'gp3', volumes: 1, sizeGb: 30, rate: 0.08, ...ebs },
    },
  };
}

describe('analyzeDrivers', () => {
  it('ranks enabled non-zero services by cost, largest first', () => {
    const estimate = estimateWorkload(workload({ ec2: { hours: 730, rate: 0.1 } }));
    const drivers = analyzeDrivers(estimate);

    assert.equal(drivers[0].id, 'ec2');
    assert.ok(drivers[0].amount >= drivers[1].amount);
  });

  it('excludes disabled and zero-cost services', () => {
    const estimate = estimateWorkload(workload({ ebs: { enabled: false } }));
    const ids = analyzeDrivers(estimate).map((driver) => driver.id);
    assert.deepEqual(ids, ['ec2']);
  });
});

describe('buildRecommendations', () => {
  it('leads with a critical item when over budget', () => {
    const estimate = estimateWorkload(workload({ budget: 1, ec2: { hours: 730, rate: 0.1 } }));
    const recs = buildRecommendations(estimate);

    assert.equal(recs[0].id, 'budget-over');
    assert.equal(recs[0].severity, 'critical');
    assert.ok(recs.some((rec) => rec.id.startsWith('driver-')));
  });

  it('gives a positive note when comfortably within budget', () => {
    const estimate = estimateWorkload(workload({ budget: 1000 }));
    const recs = buildRecommendations(estimate);

    assert.equal(recs[0].severity, 'positive');
  });

  it('names the largest driver deterministically', () => {
    const estimate = estimateWorkload(workload({ ec2: { hours: 730, rate: 0.2 } }));
    const recs = buildRecommendations(estimate);
    const driver = recs.find((rec) => rec.id.startsWith('driver-'));

    assert.equal(driver.id, 'driver-ec2');
    assert.match(driver.detail, /EC2/);
  });

  it('flags a concentration when one service dominates', () => {
    const estimate = estimateWorkload(
      workload({ ec2: { hours: 730, rate: 1 }, ebs: { sizeGb: 1, rate: 0.01 } }),
    );
    const recs = buildRecommendations(estimate);
    assert.ok(recs.some((rec) => rec.id === 'concentration'));
  });

  it('returns an empty-state recommendation when nothing is billable', () => {
    const estimate = estimateWorkload({
      budget: 100,
      services: { ec2: { enabled: false }, ebs: { enabled: false } },
    });
    const recs = buildRecommendations(estimate);

    assert.equal(recs.length, 1);
    assert.equal(recs[0].id, 'empty');
  });

  it('is deterministic for identical input', () => {
    const estimate = estimateWorkload(workload());
    assert.deepEqual(buildRecommendations(estimate), buildRecommendations(estimate));
  });
});
