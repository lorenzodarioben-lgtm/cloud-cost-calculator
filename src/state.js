/**
 * Workload state model.
 *
 * A "workload" is the normalized, DOM-independent description of what the user
 * is estimating: a region, a monthly budget, and a set of AWS service
 * configurations. The estimation engine, scenario storage, sharing, and import
 * all operate on this single shape so there is exactly one source of truth.
 */

import { clampCount, clampRange, clampZero } from './validation.js';
import { DEFAULT_REGION, DEFAULTS, getRate, getRegion, getScalarRate } from './pricing.js';

/** Resolve a service's enabled flag: honour an explicit boolean, else default. */
function resolveEnabled(value, fallbackEnabled) {
  return typeof value === 'boolean' ? value : fallbackEnabled;
}

/** Safe upper bounds so a typo can never produce an astronomical estimate. */
export const LIMITS = Object.freeze({
  ec2Quantity: 1000,
  ec2Hours: 744,
  ebsVolumes: 100,
  rdsQuantity: 100,
  rdsHours: 744,
});

/** Bumped whenever the persisted workload shape changes in a breaking way. */
export const WORKLOAD_VERSION = 1;

/** Build a fresh default workload (EC2 + EBS enabled, matching the demo estimate). */
export function createDefaultWorkload() {
  return {
    version: WORKLOAD_VERSION,
    region: DEFAULTS.region ?? 'us-east-1',
    budget: DEFAULTS.budget,
    services: {
      ec2: {
        enabled: true,
        instanceType: DEFAULTS.ec2Instance,
        quantity: 1,
        hours: DEFAULTS.ec2Hours,
        rate: DEFAULTS.ec2Rate,
      },
      ebs: {
        enabled: true,
        volumeType: DEFAULTS.storageType,
        volumes: 1,
        sizeGb: DEFAULTS.storageGb,
        rate: DEFAULTS.storageRate,
      },
      s3: {
        enabled: false,
        storageClass: 'standard',
        storageGb: 100,
        rate: getRate(DEFAULT_REGION, 's3', 'standard'),
        requests: 1_000_000,
        requestRate: getScalarRate(DEFAULT_REGION, 's3RequestPer1k'),
      },
      rds: {
        enabled: false,
        engine: 'postgres',
        instanceClass: 'db.t3.micro',
        quantity: 1,
        hours: DEFAULTS.ec2Hours,
        instanceRate: getRate(DEFAULT_REGION, 'rds', 'db.t3.micro'),
        storageGb: 20,
        storageRate: getScalarRate(DEFAULT_REGION, 'rdsStorageGbMonth'),
      },
      dataTransfer: {
        enabled: false,
        outboundGb: 100,
        rate: getScalarRate(DEFAULT_REGION, 'dataTransferOutGb'),
      },
    },
  };
}

/**
 * Coerce an arbitrary (possibly untrusted) object into a valid workload.
 * Missing fields fall back to defaults; numeric fields are clamped; unknown
 * fields are dropped. Never throws.
 */
export function normalizeWorkload(raw) {
  const defaults = createDefaultWorkload();
  const source = raw && typeof raw === 'object' ? raw : {};
  const services = source.services && typeof source.services === 'object' ? source.services : {};

  return {
    version: WORKLOAD_VERSION,
    region: typeof source.region === 'string' && source.region ? source.region : defaults.region,
    budget: clampZero(source.budget, defaults.budget),
    services: {
      ec2: normalizeEc2(services.ec2, defaults.services.ec2),
      ebs: normalizeEbs(services.ebs, defaults.services.ebs),
      s3: normalizeS3(services.s3, defaults.services.s3),
      rds: normalizeRds(services.rds, defaults.services.rds),
      dataTransfer: normalizeDataTransfer(services.dataTransfer, defaults.services.dataTransfer),
    },
  };
}

// Numeric fields coerce invalid / infinite / missing values to zero so a
// cleared input or corrupt payload never injects a phantom cost. String fields
// (instance/volume type) keep a sensible default because an empty select is not
// a meaningful state.
function normalizeEc2(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    instanceType:
      typeof source.instanceType === 'string' && source.instanceType
        ? source.instanceType
        : fallback.instanceType,
    quantity: clampCount(source.quantity, { min: 1, max: LIMITS.ec2Quantity, fallback: 1 }),
    hours: clampRange(source.hours, 0, LIMITS.ec2Hours, 0),
    rate: clampZero(source.rate, 0),
  };
}

function normalizeEbs(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    volumeType:
      typeof source.volumeType === 'string' && source.volumeType
        ? source.volumeType
        : fallback.volumeType,
    volumes: clampCount(source.volumes, { min: 1, max: LIMITS.ebsVolumes, fallback: 1 }),
    sizeGb: clampZero(source.sizeGb, 0),
    rate: clampZero(source.rate, 0),
  };
}

function normalizeS3(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    storageClass:
      typeof source.storageClass === 'string' && source.storageClass
        ? source.storageClass
        : fallback.storageClass,
    storageGb: clampZero(source.storageGb, 0),
    rate: clampZero(source.rate, 0),
    requests: clampZero(source.requests, 0),
    requestRate: clampZero(source.requestRate, 0),
  };
}

function normalizeRds(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    engine:
      typeof source.engine === 'string' && source.engine ? source.engine : fallback.engine,
    instanceClass:
      typeof source.instanceClass === 'string' && source.instanceClass
        ? source.instanceClass
        : fallback.instanceClass,
    quantity: clampCount(source.quantity, { min: 1, max: LIMITS.rdsQuantity, fallback: 1 }),
    hours: clampRange(source.hours, 0, LIMITS.rdsHours, 0),
    instanceRate: clampZero(source.instanceRate, 0),
    storageGb: clampZero(source.storageGb, 0),
    storageRate: clampZero(source.storageRate, 0),
  };
}

function normalizeDataTransfer(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    outboundGb: clampZero(source.outboundGb, 0),
    rate: clampZero(source.rate, 0),
  };
}

/** Shallow-merge a partial patch into a service without losing other fields. */
export function updateService(workload, serviceId, patch) {
  const next = normalizeWorkload(workload);
  if (!next.services[serviceId]) {
    return next;
  }
  next.services[serviceId] = { ...next.services[serviceId], ...patch };
  return normalizeWorkload(next);
}

/** Coerce the top-level numeric budget without disturbing services. */
export function setBudget(workload, budget) {
  const next = normalizeWorkload(workload);
  next.budget = clampZero(budget, next.budget);
  return next;
}

/** Guard used by tests and sharing: is this object plausibly a workload? */
export function isWorkloadLike(value) {
  return Boolean(value && typeof value === 'object' && typeof value.services === 'object');
}

/** Count of enabled services, used for empty-state handling. */
export function countEnabledServices(workload) {
  const normalized = normalizeWorkload(workload);
  return Object.values(normalized.services).filter((service) => service.enabled).length;
}

/**
 * Complete workload presets. Each spec lists the shape of every enabled
 * service (without rates); rates are resolved from the target region so a
 * preset works correctly regardless of the currently selected region.
 */
const PRESET_SPECS = [
  {
    id: 'dev',
    name: 'Small development',
    description: 'One small instance for part-time development work.',
    budget: 10,
    ec2: { instanceType: 't3.micro', quantity: 1, hours: 40 },
    ebs: { volumeType: 'gp3', volumes: 1, sizeGb: 20 },
  },
  {
    id: 'portfolio',
    name: 'Portfolio web app',
    description: 'An always-on small instance with storage, S3 hosting, and light egress.',
    budget: 25,
    ec2: { instanceType: 't3.small', quantity: 1, hours: 730 },
    ebs: { volumeType: 'gp3', volumes: 1, sizeGb: 30 },
    s3: { storageClass: 'standard', storageGb: 25, requests: 500_000 },
    dataTransfer: { outboundGb: 50 },
  },
  {
    id: 'production',
    name: 'Small production app',
    description: 'Redundant compute, a managed database, storage, and moderate egress.',
    budget: 120,
    ec2: { instanceType: 't3.medium', quantity: 2, hours: 730 },
    ebs: { volumeType: 'gp3', volumes: 2, sizeGb: 50 },
    s3: { storageClass: 'standard', storageGb: 100, requests: 2_000_000 },
    rds: { engine: 'postgres', instanceClass: 'db.t3.small', quantity: 1, hours: 730, storageGb: 50 },
    dataTransfer: { outboundGb: 200 },
  },
  {
    id: 'data-heavy',
    name: 'Data-heavy app',
    description: 'Large compute and database with heavy object storage and transfer.',
    budget: 600,
    ec2: { instanceType: 't3.large', quantity: 3, hours: 730 },
    ebs: { volumeType: 'gp3', volumes: 4, sizeGb: 200 },
    s3: { storageClass: 'standard', storageGb: 2000, requests: 20_000_000 },
    rds: { engine: 'postgres', instanceClass: 'db.m5.large', quantity: 2, hours: 730, storageGb: 500 },
    dataTransfer: { outboundGb: 2000 },
  },
];

/** Preset metadata for building selection UI. */
export function listPresets() {
  return PRESET_SPECS.map(({ id, name, description }) => ({ id, name, description }));
}

/**
 * Build a complete workload from a preset, resolving every rate from the given
 * region. Services not named by the preset are disabled (but keep sensible,
 * region-correct defaults for when they are re-enabled). Unknown preset ids
 * fall back to the default workload.
 */
export function presetWorkload(presetId, region = DEFAULT_REGION) {
  const spec = PRESET_SPECS.find((preset) => preset.id === presetId);
  const regionId = getRegion(region).id;
  const workload = createDefaultWorkload();
  workload.region = regionId;

  // Ensure every service carries region-correct rates before applying the spec.
  workload.services.ec2.rate = getRate(regionId, 'ec2', workload.services.ec2.instanceType);
  workload.services.ebs.rate = getRate(regionId, 'ebs', workload.services.ebs.volumeType);
  workload.services.s3.rate = getRate(regionId, 's3', workload.services.s3.storageClass);
  workload.services.s3.requestRate = getScalarRate(regionId, 's3RequestPer1k');
  workload.services.rds.instanceRate = getRate(regionId, 'rds', workload.services.rds.instanceClass);
  workload.services.rds.storageRate = getScalarRate(regionId, 'rdsStorageGbMonth');
  workload.services.dataTransfer.rate = getScalarRate(regionId, 'dataTransferOutGb');

  if (!spec) {
    return workload;
  }

  workload.budget = spec.budget;

  workload.services.ec2 = {
    enabled: true,
    instanceType: spec.ec2.instanceType,
    quantity: spec.ec2.quantity,
    hours: spec.ec2.hours,
    rate: getRate(regionId, 'ec2', spec.ec2.instanceType),
  };

  applyOptional(workload, 'ebs', Boolean(spec.ebs), () => ({
    volumeType: spec.ebs.volumeType,
    volumes: spec.ebs.volumes,
    sizeGb: spec.ebs.sizeGb,
    rate: getRate(regionId, 'ebs', spec.ebs.volumeType),
  }));

  applyOptional(workload, 's3', Boolean(spec.s3), () => ({
    storageClass: spec.s3.storageClass,
    storageGb: spec.s3.storageGb,
    rate: getRate(regionId, 's3', spec.s3.storageClass),
    requests: spec.s3.requests,
    requestRate: getScalarRate(regionId, 's3RequestPer1k'),
  }));

  applyOptional(workload, 'rds', Boolean(spec.rds), () => ({
    engine: spec.rds.engine,
    instanceClass: spec.rds.instanceClass,
    quantity: spec.rds.quantity,
    hours: spec.rds.hours,
    instanceRate: getRate(regionId, 'rds', spec.rds.instanceClass),
    storageGb: spec.rds.storageGb,
    storageRate: getScalarRate(regionId, 'rdsStorageGbMonth'),
  }));

  applyOptional(workload, 'dataTransfer', Boolean(spec.dataTransfer), () => ({
    outboundGb: spec.dataTransfer.outboundGb,
    rate: getScalarRate(regionId, 'dataTransferOutGb'),
  }));

  return normalizeWorkload(workload);
}

function applyOptional(workload, serviceId, enabled, buildFields) {
  if (enabled) {
    workload.services[serviceId] = { enabled: true, ...buildFields() };
  } else {
    workload.services[serviceId].enabled = false;
  }
}
