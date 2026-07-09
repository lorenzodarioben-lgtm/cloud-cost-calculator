import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateEstimate, formatUsd, getBudgetMessage } from '../src/calculator.js';

describe('calculateEstimate', () => {
  it('calculates EC2 hours times rate plus storage GB times rate', () => {
    const result = calculateEstimate({
      ec2Hours: 730,
      ec2Rate: 0.0104,
      storageGb: 30,
      storageRate: 0.08,
      budget: 15,
    });

    assert.equal(result.computeCost, 7.592);
    assert.equal(result.storageCost, 2.4);
    assert.equal(Number(result.total.toFixed(2)), 9.99);
    assert.equal(result.overBudget, false);
  });

  it('flags estimates that are over budget', () => {
    const result = calculateEstimate({
      ec2Hours: 730,
      ec2Rate: 0.0418,
      storageGb: 100,
      storageRate: 0.08,
      budget: 25,
    });

    assert.equal(result.overBudget, true);
    assert.equal(result.budgetStatus, 'over');
    assert.match(getBudgetMessage(result), /over budget/);
  });

  it('treats invalid or negative input as zero', () => {
    const result = calculateEstimate({
      ec2Hours: -5,
      ec2Rate: 'not-a-rate',
      storageGb: -20,
      storageRate: 0.08,
      budget: -1,
    });

    assert.equal(result.total, 0);
    assert.equal(result.budgetStatus, 'no-budget');
  });
});

describe('formatUsd', () => {
  it('formats values as USD', () => {
    assert.equal(formatUsd(9.992), '$9.99');
  });
});

describe('budget messages', () => {
  it('handles a zero budget as no-budget', () => {
    const result = calculateEstimate({
      ec2Hours: 730,
      ec2Rate: 0.0104,
      storageGb: 30,
      storageRate: 0.08,
      budget: 0,
    });

    assert.equal(result.budgetStatus, 'no-budget');
    assert.equal(getBudgetMessage(result), 'Add a monthly budget to enable budget warnings.');
  });

  it('shows an under-budget message when estimate is below budget', () => {
    const result = calculateEstimate({
      ec2Hours: 40,
      ec2Rate: 0.0104,
      storageGb: 10,
      storageRate: 0.08,
      budget: 5,
    });

    assert.equal(result.budgetStatus, 'under');
    assert.match(getBudgetMessage(result), /under budget/);
  });
});

describe('default estimate example', () => {
  it('rounds the default estimate to $9.99', () => {
    const result = calculateEstimate({
      ec2Hours: 730,
      ec2Rate: 0.0104,
      storageGb: 30,
      storageRate: 0.08,
      budget: 15,
    });

    assert.equal(formatUsd(result.total), '$9.99');
  });
});
