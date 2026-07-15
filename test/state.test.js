import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countEnabledServices,
  createDefaultWorkload,
  normalizeWorkload,
  updateService,
  WORKLOAD_VERSION,
} from '../src/state.js';

describe('createDefaultWorkload', () => {
  it('builds a versioned workload with EC2 and EBS enabled', () => {
    const workload = createDefaultWorkload();

    assert.equal(workload.version, WORKLOAD_VERSION);
    assert.equal(workload.services.ec2.enabled, true);
    assert.equal(workload.services.ebs.enabled, true);
    assert.equal(typeof workload.region, 'string');
    assert.ok(workload.budget > 0);
  });
});

describe('normalizeWorkload', () => {
  it('fills missing fields from defaults', () => {
    const workload = normalizeWorkload({});

    assert.equal(workload.services.ec2.instanceType, createDefaultWorkload().services.ec2.instanceType);
    assert.equal(workload.version, WORKLOAD_VERSION);
  });

  it('never throws for null, undefined, or non-objects', () => {
    assert.doesNotThrow(() => normalizeWorkload(null));
    assert.doesNotThrow(() => normalizeWorkload(undefined));
    assert.doesNotThrow(() => normalizeWorkload(42));
    assert.doesNotThrow(() => normalizeWorkload('text'));
  });

  it('clamps numeric fields and coerces strings', () => {
    const workload = normalizeWorkload({
      budget: '-3',
      services: {
        ec2: { hours: '9999', rate: '0.02' },
        ebs: { sizeGb: -50 },
      },
    });

    assert.equal(workload.budget, 0);
    assert.equal(workload.services.ec2.hours, 744);
    assert.equal(workload.services.ec2.rate, 0.02);
    assert.equal(workload.services.ebs.sizeGb, 0);
  });

  it('coerces EC2 quantity to a bounded integer with a minimum of one', () => {
    assert.equal(normalizeWorkload({ services: { ec2: { quantity: '4.6' } } }).services.ec2.quantity, 5);
    assert.equal(normalizeWorkload({ services: { ec2: { quantity: 0 } } }).services.ec2.quantity, 1);
    assert.equal(normalizeWorkload({ services: { ec2: { quantity: -3 } } }).services.ec2.quantity, 1);
    assert.equal(normalizeWorkload({ services: { ec2: { quantity: 999999 } } }).services.ec2.quantity, 1000);
  });

  it('respects an explicit disabled flag but defaults to enabled', () => {
    const workload = normalizeWorkload({ services: { ec2: { enabled: false }, ebs: {} } });

    assert.equal(workload.services.ec2.enabled, false);
    assert.equal(workload.services.ebs.enabled, true);
  });
});

describe('updateService', () => {
  it('patches a single service without disturbing others', () => {
    const workload = updateService(createDefaultWorkload(), 'ec2', { hours: 100 });

    assert.equal(workload.services.ec2.hours, 100);
    assert.equal(workload.services.ebs.enabled, true);
  });

  it('ignores unknown service ids', () => {
    const before = createDefaultWorkload();
    const after = updateService(before, 'unknown', { foo: 1 });

    assert.deepEqual(after.services, before.services);
  });
});

describe('countEnabledServices', () => {
  it('counts only enabled services', () => {
    assert.equal(countEnabledServices(createDefaultWorkload()), 2);
    assert.equal(
      countEnabledServices({ services: { ec2: { enabled: false }, ebs: { enabled: false } } }),
      0,
    );
  });
});
