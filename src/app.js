import { calculateEstimate, formatUsd, getBudgetMessage } from './calculator.js';
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

const storageKey = 'cloud-cost-calculator-state';

function populateSelect(select, rates) {
  Object.entries(rates).forEach(([name, rate]) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = `${name} — ${formatUsd(rate)}/hr`.replace('/hr', select === storageSelect ? '/GB-mo' : '/hr');
    select.append(option);
  });
}

function getSavedState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) ?? {};
  } catch {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getFormState() {
  return {
    ec2Instance: instanceSelect.value,
    storageType: storageSelect.value,
    ec2Hours: ec2HoursInput.value,
    ec2Rate: ec2RateInput.value,
    storageGb: storageGbInput.value,
    storageRate: storageRateInput.value,
    budget: budgetInput.value,
  };
}

function setFormState(state) {
  instanceSelect.value = state.ec2Instance ?? DEFAULTS.ec2Instance;
  storageSelect.value = state.storageType ?? DEFAULTS.storageType;
  ec2HoursInput.value = state.ec2Hours ?? DEFAULTS.ec2Hours;
  ec2RateInput.value = state.ec2Rate ?? EC2_RATES[instanceSelect.value] ?? DEFAULTS.ec2Rate;
  storageGbInput.value = state.storageGb ?? DEFAULTS.storageGb;
  storageRateInput.value = state.storageRate ?? STORAGE_RATES[storageSelect.value] ?? DEFAULTS.storageRate;
  budgetInput.value = state.budget ?? DEFAULTS.budget;
}

function renderEstimate() {
  const state = getFormState();
  const result = calculateEstimate(state);

  lineItems.innerHTML = `
    <li><span>EC2 compute</span><strong>${formatUsd(result.computeCost)}</strong></li>
    <li><span>EBS storage</span><strong>${formatUsd(result.storageCost)}</strong></li>
    <li><span>Budget</span><strong>${formatUsd(result.budget)}</strong></li>
  `;

  totalOutput.textContent = formatUsd(result.total);
  budgetMessage.textContent = getBudgetMessage(result);
  resultCard.dataset.status = result.budgetStatus;

  noteOutput.textContent = `${PRICING_NOTES.region}, ${PRICING_NOTES.operatingSystem}, ${PRICING_NOTES.currency}. ${PRICING_NOTES.disclaimer}`;

  saveState(state);
}

function syncRateFromSelect(select, rateInput, rates) {
  rateInput.value = rates[select.value] ?? rateInput.value;
  renderEstimate();
}

populateSelect(instanceSelect, EC2_RATES);
populateSelect(storageSelect, STORAGE_RATES);
setFormState(getSavedState());
renderEstimate();

form.addEventListener('input', renderEstimate);

instanceSelect.addEventListener('change', () => {
  syncRateFromSelect(instanceSelect, ec2RateInput, EC2_RATES);
});

storageSelect.addEventListener('change', () => {
  syncRateFromSelect(storageSelect, storageRateInput, STORAGE_RATES);
});

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    ec2HoursInput.value = button.dataset.hoursPreset;
    renderEstimate();
  });
});

resetButton.addEventListener('click', () => {
  localStorage.removeItem(storageKey);
  setFormState(DEFAULTS);
  renderEstimate();
});
