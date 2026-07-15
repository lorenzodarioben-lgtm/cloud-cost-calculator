/**
 * Scenario comparison (pure).
 *
 * Diffs two estimates (the active configuration vs a saved scenario) into a
 * structured result: per-service deltas, monthly and annual totals, a
 * percentage change where mathematically valid, and which side is cheaper.
 * Rendering and formatting live in the app layer.
 */

/**
 * Compare a saved scenario estimate (`other`) against the active estimate.
 * Deltas are expressed as `other - active` (positive means the saved scenario
 * costs more). Percentages are null when the active baseline is zero.
 */
export function compareEstimates(active, other) {
  const rows = new Map();

  const seed = (estimate, side) => {
    estimate.services.forEach((service) => {
      const row = rows.get(service.id) ?? {
        id: service.id,
        label: service.label,
        active: 0,
        other: 0,
      };
      row[side] = service.amount;
      rows.set(service.id, row);
    });
  };
  seed(active, 'active');
  seed(other, 'other');

  const services = [];
  for (const row of rows.values()) {
    if (row.active > 0 || row.other > 0) {
      row.diff = row.other - row.active;
      row.percent = row.active > 0 ? (row.diff / row.active) * 100 : null;
      services.push(row);
    }
  }
  services.sort((a, b) => Math.max(b.active, b.other) - Math.max(a.active, a.other));

  const monthlyDiff = other.total - active.total;
  const annualDiff = other.annualTotal - active.annualTotal;
  const monthlyPercent = active.total > 0 ? (monthlyDiff / active.total) * 100 : null;

  let cheaper = 'equal';
  if (other.total < active.total) {
    cheaper = 'other';
  } else if (other.total > active.total) {
    cheaper = 'active';
  }

  return {
    services,
    active: { total: active.total, annual: active.annualTotal },
    other: { total: other.total, annual: other.annualTotal },
    monthlyDiff,
    annualDiff,
    monthlyPercent,
    cheaper,
  };
}
