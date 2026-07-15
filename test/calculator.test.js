import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estimateWorkload,
  formatUsd,
  formatRate,
  getBudgetMessage,
} from '../src/calculator.js';

function baseWorkload(overrides = {}) {
  return {
    region: 'us-east-1',
    budget: 15,
    services: {
      ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 730, rate: 0.0104 },
      ebs: { enabled: true, volumeType: 'gp3', sizeGb: 30, rate: 0.08 },
    },
    ...overrides,
  };
}

describe('estimateWorkload', () => {
  it('sums EC2 compute and EBS storage into a monthly total', () => {
    const estimate = estimateWorkload(baseWorkload());

    assert.equal(estimate.serviceSubtotals.ec2, 7.592);
    assert.equal(estimate.serviceSubtotals.ebs, 2.4);
    assert.equal(Number(estimate.total.toFixed(2)), 9.99);
    assert.equal(estimate.overBudget, false);
    assert.equal(estimate.budgetStatus, 'under');
  });

  it('multiplies EC2 cost by instance quantity', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: true, instanceType: 't3.micro', quantity: 3, hours: 730, rate: 0.0104 },
          ebs: { enabled: false },
        },
      }),
    );

    assert.equal(Number(estimate.serviceSubtotals.ec2.toFixed(3)), 22.776);
    const detail = estimate.lineItems[0].detail;
    assert.match(detail, /3 ×/);
  });

  it('clamps EC2 quantity and runtime to safe limits', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: true, instanceType: 't3.micro', quantity: 999999, hours: 100000, rate: 0.01 },
          ebs: { enabled: false },
        },
      }),
    );

    // quantity capped at 1000, hours capped at 744
    assert.equal(estimate.serviceSubtotals.ec2, 1000 * 744 * 0.01);
  });

  it('returns structured line items for each enabled service', () => {
    const estimate = estimateWorkload(baseWorkload());
    const labels = estimate.lineItems.map((item) => item.label);

    assert.deepEqual(labels, ['EC2 compute', 'EBS storage']);
    assert.ok(estimate.lineItems.every((item) => typeof item.detail === 'string'));
    assert.ok(estimate.lineItems.every((item) => item.amount >= 0));
  });

  it('multiplies EBS cost by volume count and per-volume size', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: false },
          ebs: { enabled: true, volumeType: 'gp3', volumes: 4, sizeGb: 50, rate: 0.08 },
        },
      }),
    );

    assert.equal(estimate.serviceSubtotals.ebs, 4 * 50 * 0.08);
    assert.match(estimate.lineItems[0].detail, /4 ×/);
  });

  it('drops EBS from the estimate when it is disabled', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 730, rate: 0.0104 },
          ebs: { enabled: false, volumeType: 'gp3', volumes: 4, sizeGb: 50, rate: 0.08 },
        },
      }),
    );

    assert.equal(estimate.serviceSubtotals.ebs, undefined);
    assert.equal(estimate.lineItems.length, 1);
    assert.equal(Number(estimate.total.toFixed(3)), 7.592);
  });

  it('excludes disabled services from totals and line items', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: true, instanceType: 't3.micro', hours: 730, rate: 0.0104 },
          ebs: { enabled: false, volumeType: 'EBS gp3', sizeGb: 30, rate: 0.08 },
        },
      }),
    );

    assert.equal(estimate.serviceSubtotals.ebs, undefined);
    assert.equal(estimate.lineItems.length, 1);
    assert.equal(Number(estimate.total.toFixed(3)), 7.592);
    const ebs = estimate.services.find((service) => service.id === 'ebs');
    assert.equal(ebs.enabled, false);
    assert.equal(ebs.amount, 0);
  });

  it('flags estimates that exceed the budget', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        budget: 5,
        services: {
          ec2: { enabled: true, instanceType: 't3.medium', hours: 730, rate: 0.0418 },
          ebs: { enabled: true, volumeType: 'EBS gp3', sizeGb: 100, rate: 0.08 },
        },
      }),
    );

    assert.equal(estimate.overBudget, true);
    assert.equal(estimate.budgetStatus, 'over');
    assert.ok(estimate.remaining < 0);
    assert.match(getBudgetMessage(estimate), /Over budget/);
  });

  it('treats a zero budget as no-budget', () => {
    const estimate = estimateWorkload(baseWorkload({ budget: 0 }));

    assert.equal(estimate.budgetStatus, 'no-budget');
    assert.equal(getBudgetMessage(estimate), 'Add a monthly budget to enable budget warnings.');
  });

  it('coerces negative, string, NaN, and infinite inputs to zero', () => {
    const estimate = estimateWorkload({
      budget: -10,
      services: {
        ec2: { enabled: true, instanceType: 't3.micro', hours: -5, rate: 'not-a-number' },
        ebs: { enabled: true, volumeType: 'EBS gp3', sizeGb: Infinity, rate: NaN },
      },
    });

    assert.equal(estimate.total, 0);
    assert.equal(estimate.budget, 0);
    assert.equal(estimate.budgetStatus, 'no-budget');
  });

  it('handles decimal quantities precisely enough for currency rounding', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: true, instanceType: 't3.nano', hours: 12.5, rate: 0.0052 },
          ebs: { enabled: false },
        },
      }),
    );

    assert.equal(Number(estimate.total.toFixed(4)), 0.065);
  });

  it('never throws for malformed input', () => {
    assert.doesNotThrow(() => estimateWorkload(null));
    assert.doesNotThrow(() => estimateWorkload(undefined));
    assert.doesNotThrow(() => estimateWorkload('nonsense'));
    assert.equal(estimateWorkload(null).total, estimateWorkload(undefined).total);
  });
});

describe('formatting', () => {
  it('formats currency to two decimals', () => {
    assert.equal(formatUsd(9.992), '$9.99');
    assert.equal(formatUsd(0), '$0.00');
    assert.equal(formatUsd(-5), '$0.00');
  });

  it('formats fine-grained rates to four decimals', () => {
    assert.equal(formatRate(0.0104), '$0.0104');
  });
});
