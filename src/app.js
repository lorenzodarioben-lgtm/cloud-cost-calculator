import { estimateWorkload, formatUsd, getBudgetMessage } from './calculator.js';
import { createDefaultWorkload, normalizeWorkload } from './state.js';
import { DEFAULTS, EC2_RATES, PRICING_NOTES, STORAGE_RATES } from './pricing.js';

const form = document.querySelector('[data-calculator-form]');
const instanceSelect = document.querySelector('#ec2-instance');
const storageSelect = document.querySelector('#storage-type');
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
const presetButtons = document.querySelectorAll('[data-hours-preset]');
const resetButton = document.querySelector('[data-reset]');

const STORAGE_KEY = 'cloud-cost-calculator-workload';

function populateSelect(select, rates, unit) {
  select.replaceChildren();
  Object.entries(rates).forEach(([name, rate]) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = `${name} — ${formatUsd(rate)}/${unit}`;
    select.append(option);
  });
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
    region: DEFAULTS.region ?? 'us-east-1',
    budget: budgetInput.value,
    services: {
      ec2: {
        enabled: true,
        instanceType: instanceSelect.value,
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

/** Push a workload back into the form controls. */
function writeWorkload(workload) {
  const normalized = normalizeWorkload(workload);
  instanceSelect.value = normalized.services.ec2.instanceType;
  storageSelect.value = normalized.services.ebs.volumeType;
  ec2HoursInput.value = normalized.services.ec2.hours;
  ec2RateInput.value = normalized.services.ec2.rate;
  storageGbInput.value = normalized.services.ebs.sizeGb;
  storageRateInput.value = normalized.services.ebs.rate;
  budgetInput.value = normalized.budget;
}

function renderLineItems(estimate) {
  lineItems.replaceChildren();
  estimate.lineItems.forEach((item) => {
    lineItems.append(buildLineItem(item.label, formatUsd(item.amount)));
  });
  lineItems.append(buildLineItem('Budget', formatUsd(estimate.budget)));
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

function render() {
  const workload = readWorkload();
  const estimate = estimateWorkload(workload);

  renderLineItems(estimate);
  totalOutput.textContent = formatUsd(estimate.total);
  budgetMessage.textContent = getBudgetMessage(estimate);
  resultCard.dataset.status = estimate.budgetStatus;
  noteOutput.textContent = `${PRICING_NOTES.region}, ${PRICING_NOTES.operatingSystem}, ${PRICING_NOTES.currency}. ${PRICING_NOTES.disclaimer}`;

  saveWorkload(workload);
}

function syncRateFromSelect(select, rateInput, rates) {
  const rate = rates[select.value];
  if (rate !== undefined) {
    rateInput.value = rate;
  }
  render();
}

populateSelect(instanceSelect, EC2_RATES, 'hr');
populateSelect(storageSelect, STORAGE_RATES, 'GB-mo');
writeWorkload(loadWorkload());
render();

form.addEventListener('input', render);

instanceSelect.addEventListener('change', () => {
  syncRateFromSelect(instanceSelect, ec2RateInput, EC2_RATES);
});

storageSelect.addEventListener('change', () => {
  syncRateFromSelect(storageSelect, storageRateInput, STORAGE_RATES);
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
