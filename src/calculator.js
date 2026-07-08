const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clampZero(value) {
  return Math.max(0, toNumber(value));
}

export function calculateEstimate(input) {
  const ec2Hours = clampZero(input.ec2Hours);
  const ec2Rate = clampZero(input.ec2Rate);
  const storageGb = clampZero(input.storageGb);
  const storageRate = clampZero(input.storageRate);
  const budget = clampZero(input.budget);

  const computeCost = ec2Hours * ec2Rate;
  const storageCost = storageGb * storageRate;
  const total = computeCost + storageCost;
  const remaining = budget - total;
  const overBudget = budget > 0 && total > budget;

  return {
    ec2Hours,
    ec2Rate,
    storageGb,
    storageRate,
    budget,
    computeCost,
    storageCost,
    total,
    remaining,
    overBudget,
    budgetStatus: budget === 0 ? 'no-budget' : overBudget ? 'over' : 'under',
  };
}

export function formatUsd(value) {
  return MONEY_FORMATTER.format(toNumber(value));
}

export function getBudgetMessage(result) {
  if (result.budget === 0) {
    return 'Add a monthly budget to enable budget warnings.';
  }

  if (result.overBudget) {
    return `Warning: estimate is ${formatUsd(Math.abs(result.remaining))} over budget.`;
  }

  return `Good: estimate is ${formatUsd(result.remaining)} under budget.`;
}
