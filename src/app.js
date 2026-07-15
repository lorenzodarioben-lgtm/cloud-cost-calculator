import {
  budgetStateLabel,
  estimateWorkload,
  formatPercent,
  formatUsd,
  getBudgetMessage,
} from './calculator.js';
import { buildRecommendations } from './recommendations.js';
import { createDonutSvg, createLegendItems } from './charts.js';
import { createDefaultWorkload, listPresets, normalizeWorkload, presetWorkload } from './state.js';
import {
  deleteScenario,
  getScenario,
  loadScenarios,
  renameScenario,
  resolveStorage,
  saveScenario,
} from './scenarios.js';
import { compareEstimates } from './compare.js';
import { buildFilename, parseImport, toCsv, toJson } from './export.js';
import { buildShareUrl, hasShareParam, parseShareParam } from './share.js';
import {
  DEFAULT_REGION,
  PRICING_NOTES,
  getRate,
  getRegion,
  getScalarRate,
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
const ebsEnabledInput = document.querySelector('#ebs-enabled');
const ebsVolumesInput = document.querySelector('#ebs-volumes');
const storageGbInput = document.querySelector('#storage-gb');
const storageRateInput = document.querySelector('#storage-rate');
const s3EnabledInput = document.querySelector('#s3-enabled');
const s3ClassSelect = document.querySelector('#s3-class');
const s3StorageInput = document.querySelector('#s3-storage');
const s3RateInput = document.querySelector('#s3-rate');
const s3RequestsInput = document.querySelector('#s3-requests');
const s3RequestRateInput = document.querySelector('#s3-request-rate');
const rdsEnabledInput = document.querySelector('#rds-enabled');
const rdsEngineSelect = document.querySelector('#rds-engine');
const rdsClassSelect = document.querySelector('#rds-class');
const rdsQuantityInput = document.querySelector('#rds-quantity');
const rdsHoursInput = document.querySelector('#rds-hours');
const rdsRateInput = document.querySelector('#rds-rate');
const rdsStorageInput = document.querySelector('#rds-storage');
const rdsStorageRateInput = document.querySelector('#rds-storage-rate');
const dtEnabledInput = document.querySelector('#dataTransfer-enabled');
const dtGbInput = document.querySelector('#dt-gb');
const dtRateInput = document.querySelector('#dt-rate');
const budgetInput = document.querySelector('#budget');
const budgetMessage = document.querySelector('[data-budget-message]');
const resultCard = document.querySelector('[data-result-card]');
const lineItems = document.querySelector('[data-line-items]');
const totalOutput = document.querySelector('[data-total]');
const annualOutput = document.querySelector('[data-annual]');
const statusBadge = document.querySelector('[data-status-badge]');
const budgetPercentOutput = document.querySelector('[data-budget-percent]');
const progressEl = document.querySelector('[data-progress]');
const progressFill = document.querySelector('[data-progress-fill]');
const budgetAmountOutput = document.querySelector('[data-budget-amount]');
const remainingLabel = document.querySelector('[data-remaining-label]');
const remainingOutput = document.querySelector('[data-remaining]');
const recommendationList = document.querySelector('[data-recommendations]');
const breakdownBody = document.querySelector('[data-breakdown-body]');
const breakdownEmpty = document.querySelector('[data-breakdown-empty]');
const breakdownChart = document.querySelector('[data-breakdown-chart]');
const breakdownLegend = document.querySelector('[data-breakdown-legend]');
const noteOutput = document.querySelector('[data-pricing-note]');
const regionTag = document.querySelector('[data-region-tag]');
const presetButtons = document.querySelectorAll('[data-hours-preset]');
const presetBar = document.querySelector('[data-preset-buttons]');
const resetButton = document.querySelector('[data-reset]');
const scenarioForm = document.querySelector('[data-scenario-form]');
const scenarioNameInput = document.querySelector('#scenario-name');
const scenarioList = document.querySelector('[data-scenario-list]');
const scenarioEmpty = document.querySelector('[data-scenario-empty]');
const compareTarget = document.querySelector('[data-compare-target]');
const compareEmpty = document.querySelector('[data-compare-empty]');
const compareBody = document.querySelector('[data-compare-body]');
const compareSummary = document.querySelector('[data-compare-summary]');
const compareRows = document.querySelector('[data-compare-rows]');
const compareFoot = document.querySelector('[data-compare-foot]');
const compareOtherLabel = document.querySelector('[data-compare-other-label]');
const exportJsonButton = document.querySelector('[data-export-json]');
const exportCsvButton = document.querySelector('[data-export-csv]');
const copyLinkButton = document.querySelector('[data-copy-link]');
const importInput = document.querySelector('[data-import]');
const shareFeedback = document.querySelector('[data-share-feedback]');

const scenarioStorage = resolveStorage();
let editingScenarioId = null;

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const STORAGE_KEY = 'cloud-cost-calculator-workload';

/** Optional services that can be toggled on/off from their section header. */
const OPTIONAL_SERVICES = ['ebs', 's3', 'rds', 'dataTransfer'];

/** Visually and functionally disable a service section when it is switched off. */
function reflectServiceEnabled(serviceId, enabled) {
  const section = document.querySelector(`[data-service-section="${serviceId}"]`);
  if (!section) {
    return;
  }
  section.classList.toggle('is-disabled', !enabled);
  section
    .querySelectorAll('[data-service-fields] input, [data-service-fields] select')
    .forEach((element) => {
      element.disabled = !enabled;
    });
}

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

function populatePresets() {
  presetBar.replaceChildren();
  listPresets().forEach((preset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-chip';
    button.dataset.preset = preset.id;
    button.setAttribute('aria-pressed', 'false');
    button.title = preset.description;
    button.textContent = preset.name;
    button.addEventListener('click', () => applyPreset(preset.id, button));
    presetBar.append(button);
  });
}

function applyPreset(presetId, button) {
  writeWorkload(presetWorkload(presetId, currentRegion()));
  render();
  button.setAttribute('aria-pressed', 'true');
}

/** Deselect any active preset chip (called whenever the config diverges). */
function clearPresetSelection() {
  presetBar
    .querySelectorAll('[data-preset]')
    .forEach((button) => button.setAttribute('aria-pressed', 'false'));
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
        enabled: ebsEnabledInput.checked,
        volumeType: storageSelect.value,
        volumes: ebsVolumesInput.value,
        sizeGb: storageGbInput.value,
        rate: storageRateInput.value,
      },
      s3: {
        enabled: s3EnabledInput.checked,
        storageClass: s3ClassSelect.value,
        storageGb: s3StorageInput.value,
        rate: s3RateInput.value,
        requests: s3RequestsInput.value,
        requestRate: s3RequestRateInput.value,
      },
      rds: {
        enabled: rdsEnabledInput.checked,
        engine: rdsEngineSelect.value,
        instanceClass: rdsClassSelect.value,
        quantity: rdsQuantityInput.value,
        hours: rdsHoursInput.value,
        instanceRate: rdsRateInput.value,
        storageGb: rdsStorageInput.value,
        storageRate: rdsStorageRateInput.value,
      },
      dataTransfer: {
        enabled: dtEnabledInput.checked,
        outboundGb: dtGbInput.value,
        rate: dtRateInput.value,
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
  ebsEnabledInput.checked = normalized.services.ebs.enabled;
  ebsVolumesInput.value = normalized.services.ebs.volumes;
  storageGbInput.value = normalized.services.ebs.sizeGb;
  storageRateInput.value = normalized.services.ebs.rate;
  s3EnabledInput.checked = normalized.services.s3.enabled;
  populateServiceOptions(s3ClassSelect, getServiceOptions(normalized.region, 's3'), normalized.services.s3.storageClass);
  s3StorageInput.value = normalized.services.s3.storageGb;
  s3RateInput.value = normalized.services.s3.rate;
  s3RequestsInput.value = normalized.services.s3.requests;
  s3RequestRateInput.value = normalized.services.s3.requestRate;
  rdsEnabledInput.checked = normalized.services.rds.enabled;
  rdsEngineSelect.value = normalized.services.rds.engine;
  populateServiceOptions(rdsClassSelect, getServiceOptions(normalized.region, 'rds'), normalized.services.rds.instanceClass);
  rdsQuantityInput.value = normalized.services.rds.quantity;
  rdsHoursInput.value = normalized.services.rds.hours;
  rdsRateInput.value = normalized.services.rds.instanceRate;
  rdsStorageInput.value = normalized.services.rds.storageGb;
  rdsStorageRateInput.value = normalized.services.rds.storageRate;
  dtEnabledInput.checked = normalized.services.dataTransfer.enabled;
  dtGbInput.value = normalized.services.dataTransfer.outboundGb;
  dtRateInput.value = normalized.services.dataTransfer.rate;
  budgetInput.value = normalized.budget;

  OPTIONAL_SERVICES.forEach((serviceId) => {
    reflectServiceEnabled(serviceId, normalized.services[serviceId].enabled);
  });
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
  if (estimate.lineItems.length === 0) {
    lineItems.append(buildLineItem('No services enabled', formatUsd(0)));
    return;
  }
  estimate.lineItems.forEach((item) => {
    lineItems.append(buildLineItem(item.label, formatUsd(item.amount)));
  });
}

function renderBudgetHealth(estimate) {
  annualOutput.textContent = formatUsd(estimate.annualTotal);
  statusBadge.textContent = budgetStateLabel(estimate.budgetStatus);
  budgetAmountOutput.textContent = formatUsd(estimate.budget);

  const hasBudget = estimate.budgetStatus !== 'no-budget';
  budgetPercentOutput.textContent = hasBudget ? formatPercent(estimate.budgetUsedPercent) : '—';

  const percent = hasBudget ? Math.min(100, estimate.budgetUsedPercent) : 0;
  progressFill.style.width = `${percent}%`;
  progressEl.setAttribute('aria-valuenow', String(Math.round(percent)));
  progressEl.setAttribute(
    'aria-valuetext',
    hasBudget
      ? `${formatPercent(estimate.budgetUsedPercent)} of budget used`
      : 'No budget set',
  );

  if (estimate.overBudget) {
    remainingLabel.textContent = 'Over by';
    remainingOutput.textContent = formatUsd(estimate.overage);
  } else {
    remainingLabel.textContent = 'Remaining';
    remainingOutput.textContent = hasBudget ? formatUsd(estimate.remaining) : '—';
  }

  budgetMessage.textContent = getBudgetMessage(estimate);
}

function renderRecommendations(estimate) {
  recommendationList.replaceChildren();
  buildRecommendations(estimate).forEach((recommendation) => {
    const item = document.createElement('li');
    item.className = 'recommendation';
    item.dataset.severity = recommendation.severity;
    const title = document.createElement('strong');
    title.textContent = recommendation.title;
    const detail = document.createElement('span');
    detail.textContent = recommendation.detail;
    item.append(title, detail);
    recommendationList.append(item);
  });
}

function renderBreakdown(estimate) {
  const hasData = estimate.total > 0 && estimate.lineItems.length > 0;
  breakdownEmpty.hidden = hasData;
  breakdownBody.hidden = !hasData;

  breakdownChart.replaceChildren();
  breakdownLegend.replaceChildren();
  if (!hasData) {
    return;
  }
  breakdownChart.append(createDonutSvg(estimate));
  createLegendItems(estimate).forEach((item) => breakdownLegend.append(item));
}

function render() {
  clearPresetSelection();
  const workload = readWorkload();
  const estimate = estimateWorkload(workload);
  const region = getRegion(estimate.region);

  renderLineItems(estimate);
  totalOutput.textContent = formatUsd(estimate.total);
  resultCard.dataset.status = estimate.budgetStatus;
  renderBreakdown(estimate);
  renderBudgetHealth(estimate);
  renderRecommendations(estimate);
  regionTag.textContent = region.id;
  noteOutput.textContent = `${region.label} · ${PRICING_NOTES.operatingSystem} · ${PRICING_NOTES.currency}. ${PRICING_NOTES.disclaimer}`;

  saveWorkload(workload);
  renderComparison();
}

/** Sync an editable rate input to the sample rate for the current selection. */
function syncRate(rateInput, serviceKey, optionId) {
  const rate = getRate(currentRegion(), serviceKey, optionId);
  if (rate !== undefined) {
    rateInput.value = rate;
  }
}

/* --- Scenario management --- */

function scenarioMeta(scenario) {
  const total = estimateWorkload(scenario.workload).total;
  const savedAt = new Date(scenario.savedAt);
  const when = Number.isNaN(savedAt.getTime()) ? '' : ` · saved ${DATE_FORMATTER.format(savedAt)}`;
  return `${formatUsd(total)}/mo${when}`;
}

function actionButton(label, dataAttr, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  button.setAttribute(dataAttr, '');
  return button;
}

function buildScenarioRow(scenario) {
  const li = document.createElement('li');
  li.className = 'scenario';
  li.dataset.id = scenario.id;

  if (editingScenarioId === scenario.id) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = scenario.name;
    input.maxLength = 60;
    input.className = 'scenario-rename-input';
    input.setAttribute('aria-label', 'New scenario name');

    const save = actionButton('Save', 'data-rename-save');
    const cancel = actionButton('Cancel', 'data-rename-cancel');

    const commit = () => {
      renameScenario(scenarioStorage, scenario.id, input.value);
      editingScenarioId = null;
      renderScenarios();
    };
    save.addEventListener('click', commit);
    cancel.addEventListener('click', () => {
      editingScenarioId = null;
      renderScenarios();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      } else if (event.key === 'Escape') {
        editingScenarioId = null;
        renderScenarios();
      }
    });

    const actions = document.createElement('div');
    actions.className = 'scenario-actions';
    actions.append(save, cancel);
    li.append(input, actions);
    // focus the field after it is in the DOM
    queueMicrotask(() => input.focus());
    return li;
  }

  const main = document.createElement('div');
  main.className = 'scenario-main';
  const name = document.createElement('strong');
  name.className = 'scenario-name';
  name.textContent = scenario.name;
  const meta = document.createElement('span');
  meta.className = 'scenario-meta';
  meta.textContent = scenarioMeta(scenario);
  main.append(name, meta);

  const actions = document.createElement('div');
  actions.className = 'scenario-actions';
  const load = actionButton('Load', 'data-load');
  const rename = actionButton('Rename', 'data-rename');
  const remove = actionButton('Delete', 'data-delete', 'danger');
  load.addEventListener('click', () => {
    writeWorkload(scenario.workload);
    render();
  });
  rename.addEventListener('click', () => {
    editingScenarioId = scenario.id;
    renderScenarios();
  });
  remove.addEventListener('click', () => {
    deleteScenario(scenarioStorage, scenario.id);
    if (editingScenarioId === scenario.id) {
      editingScenarioId = null;
    }
    renderScenarios();
  });
  actions.append(load, rename, remove);

  li.append(main, actions);
  return li;
}

function renderScenarios() {
  const scenarios = loadScenarios(scenarioStorage);
  scenarioEmpty.hidden = scenarios.length > 0;
  scenarioList.replaceChildren();
  scenarios.forEach((scenario) => scenarioList.append(buildScenarioRow(scenario)));
  populateCompareTargets(scenarios);
  renderComparison();
}

/* --- Scenario comparison --- */

function signedUsd(value) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatUsd(Math.abs(value))}`;
}

function diffDirection(value) {
  return value > 0 ? 'up' : value < 0 ? 'down' : 'zero';
}

function populateCompareTargets(scenarios) {
  const previous = compareTarget.value;
  compareTarget.replaceChildren();
  scenarios.forEach((scenario) => {
    const option = document.createElement('option');
    option.value = scenario.id;
    option.textContent = scenario.name;
    compareTarget.append(option);
  });
  if (scenarios.some((scenario) => scenario.id === previous)) {
    compareTarget.value = previous;
  }
}

function cell(text, className, label) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) {
    td.className = className;
  }
  if (label) {
    td.dataset.label = label;
  }
  return td;
}

function diffCell(diff, percent, label = 'Difference') {
  const td = document.createElement('td');
  td.className = 'compare-diff';
  td.dataset.dir = diffDirection(diff);
  td.dataset.label = label;
  const amount = document.createElement('span');
  amount.textContent = signedUsd(diff);
  td.append(amount);
  if (percent !== null && percent !== undefined && Number.isFinite(percent) && diff !== 0) {
    const pct = document.createElement('small');
    pct.textContent = `${percent > 0 ? '+' : ''}${formatPercent(percent)}`;
    td.append(pct);
  }
  return td;
}

function comparisonSummary(result, name) {
  const active = formatUsd(result.active.total);
  const other = formatUsd(result.other.total);
  if (result.cheaper === 'equal') {
    return `Current estimate matches “${name}” at ${active}/mo.`;
  }
  const magnitude = formatUsd(Math.abs(result.monthlyDiff));
  const annual = formatUsd(Math.abs(result.annualDiff));
  if (result.cheaper === 'active') {
    const pct = result.monthlyPercent !== null ? ` (${formatPercent(Math.abs(result.monthlyPercent))} less)` : '';
    return `Current estimate is ${magnitude}/mo cheaper than “${name}”${pct} — ${active} vs ${other}, about ${annual}/yr.`;
  }
  return `Current estimate is ${magnitude}/mo more than “${name}” — ${active} vs ${other}, about ${annual}/yr extra.`;
}

function renderComparison() {
  const scenarios = loadScenarios(scenarioStorage);
  if (scenarios.length === 0) {
    compareEmpty.hidden = false;
    compareBody.hidden = true;
    return;
  }

  const scenario = getScenario(scenarioStorage, compareTarget.value) ?? scenarios[0];
  compareTarget.value = scenario.id;
  compareEmpty.hidden = true;
  compareBody.hidden = false;
  compareOtherLabel.textContent = scenario.name;

  const active = estimateWorkload(readWorkload());
  const other = estimateWorkload(scenario.workload);
  const result = compareEstimates(active, other);

  compareSummary.textContent = comparisonSummary(result, scenario.name);

  compareRows.replaceChildren();
  result.services.forEach((row) => {
    const tr = document.createElement('tr');
    tr.append(
      cell(row.label, 'compare-service'),
      cell(formatUsd(row.active), 'num', 'Current'),
      cell(formatUsd(row.other), 'num', 'Saved'),
      diffCell(row.diff, row.percent),
    );
    compareRows.append(tr);
  });

  compareFoot.replaceChildren();
  compareFoot.append(
    footRow('Monthly total', formatUsd(result.active.total), formatUsd(result.other.total), result.monthlyDiff, result.monthlyPercent),
    footRow('Annual total', formatUsd(result.active.annual), formatUsd(result.other.annual), result.annualDiff, result.monthlyPercent),
  );
}

function footRow(label, activeText, otherText, diff, percent) {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = label;
  tr.append(th, cell(activeText, 'num', 'Current'), cell(otherText, 'num', 'Saved'), diffCell(diff, percent));
  return tr;
}

/* --- Export, import, and sharing --- */

function setShareFeedback(message, kind = 'info') {
  shareFeedback.textContent = message;
  shareFeedback.dataset.kind = kind;
}

function downloadBlob(contents, mimeType, filename) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Release the object URL on the next tick so the download can start first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportJson() {
  const filename = buildFilename('estimate', 'json');
  downloadBlob(toJson(readWorkload()), 'application/json', filename);
  setShareFeedback(`Exported ${filename}.`, 'success');
}

function exportCsv() {
  const filename = buildFilename('estimate', 'csv');
  downloadBlob(toCsv(estimateWorkload(readWorkload())), 'text/csv', filename);
  setShareFeedback(`Exported ${filename}.`, 'success');
}

async function importJsonFile(file) {
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const result = parseImport(text);
    if (!result.ok) {
      setShareFeedback(result.error, 'error');
      return;
    }
    writeWorkload(result.workload);
    render();
    setShareFeedback(
      result.name ? `Imported “${result.name}”.` : 'Imported estimate.',
      'success',
    );
  } catch {
    setShareFeedback('Could not read that file.', 'error');
  }
}

async function copyShareLink() {
  const url = buildShareUrl(readWorkload(), window.location.origin + window.location.pathname);
  try {
    await navigator.clipboard.writeText(url);
    setShareFeedback('Share link copied to clipboard.', 'success');
  } catch {
    // Clipboard may be blocked (insecure context); surface the link instead.
    setShareFeedback(`Copy this link: ${url}`, 'info');
  }
}

/* --- Initialization --- */

populateRegions(regionSelect);
populatePresets();

const sharedWorkload = parseShareParam(window.location.search);
writeWorkload(sharedWorkload ?? loadWorkload());
render();
renderScenarios();

if (sharedWorkload) {
  setShareFeedback('Loaded a shared estimate from the link.', 'success');
} else if (hasShareParam(window.location.search)) {
  setShareFeedback('That share link was invalid, so your saved estimate is shown.', 'error');
}

exportJsonButton.addEventListener('click', exportJson);
exportCsvButton.addEventListener('click', exportCsv);
copyLinkButton.addEventListener('click', copyShareLink);
importInput.addEventListener('change', () => {
  importJsonFile(importInput.files[0]);
  importInput.value = '';
});

scenarioForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = scenarioNameInput.value.trim();
  if (!name) {
    scenarioNameInput.focus();
    return;
  }
  saveScenario(scenarioStorage, name, readWorkload());
  scenarioNameInput.value = '';
  renderScenarios();
});

compareTarget.addEventListener('change', renderComparison);

form.addEventListener('input', render);

regionSelect.addEventListener('change', () => {
  const region = currentRegion();
  populateServiceOptions(instanceSelect, getServiceOptions(region, 'ec2'));
  populateServiceOptions(storageSelect, getServiceOptions(region, 'ebs'));
  populateServiceOptions(s3ClassSelect, getServiceOptions(region, 's3'));
  populateServiceOptions(rdsClassSelect, getServiceOptions(region, 'rds'));
  syncRate(ec2RateInput, 'ec2', instanceSelect.value);
  syncRate(storageRateInput, 'ebs', storageSelect.value);
  syncRate(s3RateInput, 's3', s3ClassSelect.value);
  syncRate(rdsRateInput, 'rds', rdsClassSelect.value);
  s3RequestRateInput.value = getScalarRate(region, 's3RequestPer1k');
  rdsStorageRateInput.value = getScalarRate(region, 'rdsStorageGbMonth');
  dtRateInput.value = getScalarRate(region, 'dataTransferOutGb');
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

s3ClassSelect.addEventListener('change', () => {
  syncRate(s3RateInput, 's3', s3ClassSelect.value);
  render();
});

rdsClassSelect.addEventListener('change', () => {
  syncRate(rdsRateInput, 'rds', rdsClassSelect.value);
  render();
});

OPTIONAL_SERVICES.forEach((serviceId) => {
  const toggle = document.querySelector(`#${serviceId}-enabled`);
  toggle?.addEventListener('change', () => {
    reflectServiceEnabled(serviceId, toggle.checked);
    render();
  });
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
