import { estimateWorkload, formatUsd, getBudgetMessage } from './calculator.js';
import { createDefaultWorkload, normalizeWorkload } from './state.js';
import {
  DEFAULT_REGION,
  PRICING_NOTES,
  getRate,
  getRegion,
  getServiceOptions,
  listRegions,
} from './pricing.js';

const form = document.querySelector('[data-calculator-form]');
const regionSelect = document.querySelector('#region');
const instanceSelect = document.querySelector('#ec2-instance');
const storageSelect = document.querySelector('#storage-type');
const ec2QuantityInput = document.querySelector('#ec2-quantity');
const ec2HoursInput = document.querySelector('#ec2-hours');
const ec2RateInput = document.querySelector('#ec2-rate');
const storageGbInput = document.querySelector('#storage-gb');
const storageRateInput = document.querySelector('#storage-rate');
const budgetInput = document.querySelector('#budget');
const budgetMessage = document.querySelector('[data-budget-message]');
const resultCard = document.querySelector('[data-result-card]');
const lineItems = document.querySelector('[data-line-items]');
const totalOutput = document.querySelector('[data-total]');
const noteOutput = document.querySelector('[data-pricing-note]');
const regionTag = document.querySelector('[data-region-tag]');
const presetButtons = document.querySelectorAll('[data-hours-preset]');
const resetButton = document.querySelector('[data-reset]');

const STORAGE_KEY = 'cloud-cost-calculator-workload';

function populateRegions(select) {
  select.replaceChildren();
  listRegions().forEach(({ id, label }) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label;
    select.append(option);
  });
}

/** Populate a service select from region option data, preserving selection. */
function populateServiceOptions(select, options, preferredValue) {
  const previous = preferredValue ?? select.value;
  select.replaceChildren();
  options.forEach(({ id, label, spec }) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = spec ? `${label} · ${spec}` : label;
    select.append(option);
  });
  if (options.some((option) => option.id === previous)) {
    select.value = previous;
  }
}

function currentRegion() {
  return regionSelect.value || DEFAULT_REGION;
}

function loadWorkload() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeWorkload(JSON.parse(raw)) : createDefaultWorkload();
  } catch {
    return createDefaultWorkload();
  }
}

function saveWorkload(workload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workload));
  } catch {
    /* storage may be unavailable (private mode); estimates still work in-memory */
  }
}

/** Read the current form controls into a normalized workload. */
function readWorkload() {
  return normalizeWorkload({
    region: currentRegion(),
    budget: budgetInput.value,
    services: {
      ec2: {
        enabled: true,
        instanceType: instanceSelect.value,
        quantity: ec2QuantityInput.value,
        hours: ec2HoursInput.value,
        rate: ec2RateInput.value,
      },
      ebs: {
        enabled: true,
        volumeType: storageSelect.value,
        sizeGb: storageGbInput.value,
        rate: storageRateInput.value,
      },
    },
  });
}

/** Push a workload back into the form controls, syncing region option sets. */
function writeWorkload(workload) {
  const normalized = normalizeWorkload(workload);
  regionSelect.value = normalized.region;
  populateServiceOptions(instanceSelect, getServiceOptions(normalized.region, 'ec2'), normalized.services.ec2.instanceType);
  populateServiceOptions(storageSelect, getServiceOptions(normalized.region, 'ebs'), normalized.services.ebs.volumeType);
  ec2QuantityInput.value = normalized.services.ec2.quantity;
  ec2HoursInput.value = normalized.services.ec2.hours;
  ec2RateInput.value = normalized.services.ec2.rate;
  storageGbInput.value = normalized.services.ebs.sizeGb;
  storageRateInput.value = normalized.services.ebs.rate;
  budgetInput.value = normalized.budget;
}

function buildLineItem(label, value) {
  const li = document.createElement('li');
  const name = document.createElement('span');
  name.textContent = label;
  const amount = document.createElement('strong');
  amount.textContent = value;
  li.append(name, amount);
  return li;
}

function renderLineItems(estimate) {
  lineItems.replaceChildren();
  estimate.lineItems.forEach((item) => {
    lineItems.append(buildLineItem(item.label, formatUsd(item.amount)));
  });
  lineItems.append(buildLineItem('Budget', formatUsd(estimate.budget)));
}

function render() {
  const workload = readWorkload();
  const estimate = estimateWorkload(workload);
  const region = getRegion(estimate.region);

  renderLineItems(estimate);
  totalOutput.textContent = formatUsd(estimate.total);
  budgetMessage.textContent = getBudgetMessage(estimate);
  resultCard.dataset.status = estimate.budgetStatus;
  regionTag.textContent = region.id;
  noteOutput.textContent = `${region.label} · ${PRICING_NOTES.operatingSystem} · ${PRICING_NOTES.currency}. ${PRICING_NOTES.disclaimer}`;

  saveWorkload(workload);
}

/** Sync an editable rate input to the sample rate for the current selection. */
function syncRate(rateInput, serviceKey, optionId) {
  const rate = getRate(currentRegion(), serviceKey, optionId);
  if (rate !== undefined) {
    rateInput.value = rate;
  }
}

populateRegions(regionSelect);
writeWorkload(loadWorkload());
render();

form.addEventListener('input', render);

regionSelect.addEventListener('change', () => {
  const region = currentRegion();
  populateServiceOptions(instanceSelect, getServiceOptions(region, 'ec2'));
  populateServiceOptions(storageSelect, getServiceOptions(region, 'ebs'));
  syncRate(ec2RateInput, 'ec2', instanceSelect.value);
  syncRate(storageRateInput, 'ebs', storageSelect.value);
  render();
});

instanceSelect.addEventListener('change', () => {
  syncRate(ec2RateInput, 'ec2', instanceSelect.value);
  render();
});

storageSelect.addEventListener('change', () => {
  syncRate(storageRateInput, 'ebs', storageSelect.value);
  render();
});

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    ec2HoursInput.value = button.dataset.hoursPreset;
    render();
  });
});

resetButton.addEventListener('click', () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
  writeWorkload(createDefaultWorkload());
  render();
});
