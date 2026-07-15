import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFilename, parseImport, toCsv, toExportObject, toJson } from '../src/export.js';
import { createDefaultWorkload } from '../src/state.js';
import { estimateWorkload } from '../src/calculator.js';

describe('JSON export/import', () => {
  it('round-trips a workload through export and import', () => {
    const workload = createDefaultWorkload();
    const json = toJson(workload, 'Baseline');
    const result = parseImport(json);

    assert.equal(result.ok, true);
    assert.equal(result.name, 'Baseline');
    assert.deepEqual(result.workload.services.ec2, workload.services.ec2);
  });

  it('stamps app id and version into the envelope', () => {
    const envelope = toExportObject(createDefaultWorkload());
    assert.equal(envelope.app, 'cloud-cost-calculator');
    assert.equal(envelope.version, 1);
    assert.equal(typeof envelope.exportedAt, 'string');
  });

  it('accepts a bare workload (no envelope)', () => {
    const result = parseImport(JSON.stringify(createDefaultWorkload()));
    assert.equal(result.ok, true);
    assert.equal(result.workload.services.ebs.enabled, true);
  });

  it('rejects invalid JSON and non-workload objects', () => {
    assert.equal(parseImport('{not json').ok, false);
    assert.equal(parseImport('42').ok, false);
    assert.equal(parseImport('{"foo":"bar"}').ok, false);
    assert.equal(parseImport('null').ok, false);
  });
});

describe('CSV export', () => {
  it('lists each line item and a total row', () => {
    const estimate = estimateWorkload(createDefaultWorkload());
    const csv = toCsv(estimate);
    const lines = csv.split('\r\n');

    assert.equal(lines[0], 'Service,Detail,Monthly (USD)');
    assert.ok(lines.some((line) => line.startsWith('EC2 compute')));
    assert.ok(lines.at(-1).startsWith('Total,'));
  });

  it('escapes cells that contain commas or quotes', () => {
    const estimate = {
      lineItems: [{ serviceLabel: 'Odd, "svc"', detail: 'a,b', amount: 1.5 }],
      total: 1.5,
    };
    const csv = toCsv(estimate);
    assert.ok(csv.includes('"Odd, ""svc"""'));
    assert.ok(csv.includes('"a,b"'));
  });
});

describe('buildFilename', () => {
  it('produces a safe, dated filename', () => {
    const name = buildFilename('My Prod Estimate!', 'json');
    assert.match(name, /^cloud-cost-my-prod-estimate-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('falls back to a default base when empty', () => {
    assert.match(buildFilename('', 'csv'), /^cloud-cost-estimate-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
