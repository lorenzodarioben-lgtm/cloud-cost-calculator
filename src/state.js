/**
 * Workload state model.
 *
 * A "workload" is the normalized, DOM-independent description of what the user
 * is estimating: a region, a monthly budget, and a set of AWS service
 * configurations. The estimation engine, scenario storage, sharing, and import
 * all operate on this single shape so there is exactly one source of truth.
 */

import { clampRange, clampZero, isEnabled } from './validation.js';
import { DEFAULTS } from './pricing.js';

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
        hours: DEFAULTS.ec2Hours,
        rate: DEFAULTS.ec2Rate,
      },
      ebs: {
        enabled: true,
        volumeType: DEFAULTS.storageType,
        sizeGb: DEFAULTS.storageGb,
        rate: DEFAULTS.storageRate,
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
    enabled: isEnabled(source.enabled),
    instanceType:
      typeof source.instanceType === 'string' && source.instanceType
        ? source.instanceType
        : fallback.instanceType,
    hours: clampRange(source.hours, 0, 744, 0),
    rate: clampZero(source.rate, 0),
  };
}

function normalizeEbs(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: isEnabled(source.enabled),
    volumeType:
      typeof source.volumeType === 'string' && source.volumeType
        ? source.volumeType
        : fallback.volumeType,
    sizeGb: clampZero(source.sizeGb, 0),
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
