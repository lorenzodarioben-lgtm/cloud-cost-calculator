import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateWorkload } from '../src/calculator.js';
import { compareEstimates } from '../src/compare.js';

function onlyEc2(hours, rate) {
  return estimateWorkload({
    budget: 100,
    services: {
      ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours, rate },
      ebs: { enabled: false },
    },
  });
}

describe('compareEstimates', () => {
  it('reports the cheaper side and signed monthly/annual deltas', () => {
    const active = onlyEc2(100, 1); // $100/mo
    const other = onlyEc2(150, 1); // $150/mo
    const result = compareEstimates(active, other);

    assert.equal(result.monthlyDiff, 50);
    assert.equal(result.annualDiff, 600);
    assert.equal(result.cheaper, 'active');
    assert.equal(result.monthlyPercent, 50);
  });

  it('flags the saved scenario as cheaper when it costs less', () => {
    const result = compareEstimates(onlyEc2(150, 1), onlyEc2(100, 1));
    assert.equal(result.cheaper, 'other');
    assert.equal(result.monthlyDiff, -50);
    assert.ok(Math.abs(result.monthlyPercent - (-100 / 3)) < 1e-9);
  });

  it('treats equal totals as equal with a zero delta', () => {
    const result = compareEstimates(onlyEc2(100, 1), onlyEc2(100, 1));
    assert.equal(result.cheaper, 'equal');
    assert.equal(result.monthlyDiff, 0);
  });

  it('returns a null percentage when the active baseline is zero', () => {
    const result = compareEstimates(onlyEc2(0, 1), onlyEc2(100, 1));
    assert.equal(result.monthlyPercent, null);
    assert.equal(result.monthlyDiff, 100);
  });

  it('produces per-service deltas for services that appear on either side', () => {
    const active = estimateWorkload({
      budget: 100,
      services: {
        ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 100, rate: 1 },
        ebs: { enabled: false },
      },
    });
    const other = estimateWorkload({
      budget: 100,
      services: {
        ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 100, rate: 1 },
        ebs: { enabled: true, volumeType: 'gp3', volumes: 1, sizeGb: 100, rate: 0.1 },
      },
    });
    const result = compareEstimates(active, other);
    const ebsRow = result.services.find((row) => row.id === 'ebs');

    assert.ok(ebsRow, 'EBS should appear because it is non-zero on one side');
    assert.equal(ebsRow.active, 0);
    assert.equal(ebsRow.other, 10);
    assert.equal(ebsRow.diff, 10);
    assert.equal(ebsRow.percent, null); // active baseline zero
  });
});
