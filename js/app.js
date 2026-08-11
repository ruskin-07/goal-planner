// Step navigation, state object, and form validation for the 3-step flow.
// All money math is delegated to calc.js — this file never invents formulas.

import { initReveal } from './whatif.js';
import { decodeStateFromURL, initShare } from './share.js';
import { track, identifyUser, EVENTS } from './analytics.js';
import { PARSE_ENABLED } from './config.js';

const state = {
  step: 0,
  goalName: '',
  goalType: 'Custom',
  goalCost: null,
  currentSavings: null,
  monthlyIncome: null,
  monthlyExpenses: null,
  hasTargetDate: false,
  targetMonth: null,
  targetYear: null,
};

let goalStartedFired = false;
function fireGoalStarted() {
  if (goalStartedFired) return;
  goalStartedFired = true;
  track(EVENTS.GOAL_STARTED);
}

const steps = document.querySelectorAll('.step');

const startBtn = document.getElementById('start-btn');
const backBtns = document.querySelectorAll('[data-back]');
const toStep2Btn = document.getElementById('to-step-2');
const toStep3Btn = document.getElementById('to-step-3');

const goalNameInput = document.getElementById('goal-name');
const goalCostInput = document.getElementById('goal-cost');
const goalError = document.getElementById('goal-error');
const presetChips = document.getElementById('preset-chips');

const aiGoalEntry = document.getElementById('ai-goal-entry');
const manualGoalFields = document.getElementById('manual-goal-fields');
const aiGoalTextInput = document.getElementById('ai-goal-text');
const aiGoalError = document.getElementById('ai-goal-error');
const aiParseBtn = document.getElementById('ai-parse-btn');
const aiManualLink = document.getElementById('ai-manual-link');

const currentSavingsInput = document.getElementById('current-savings');
const monthlyIncomeInput = document.getElementById('monthly-income');
const monthlyExpensesInput = document.getElementById('monthly-expenses');
const fill70Btn = document.getElementById('fill-70');
const financesError = document.getElementById('finances-error');

const targetDateDetails = document.getElementById('target-date-details');
const targetMonthSelect = document.getElementById('target-month');
const targetYearInput = document.getElementById('target-year');

const retentionForm = document.getElementById('retention-form');
const retentionEmailInput = document.getElementById('retention-email');
const retentionPrompt = document.getElementById('retention-prompt');
const retentionThankyou = document.getElementById('retention-thankyou');

function goToStep(stepIndex) {
  state.step = stepIndex;
  steps.forEach((section) => {
    section.classList.toggle('is-active', Number(section.dataset.step) === stepIndex);
  });
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function hideError(el) {
  el.hidden = true;
  el.textContent = '';
}

function isPositiveNumber(value) {
  return typeof value === 'number' && !Number.isNaN(value) && value > 0;
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0;
}

function isTargetDateValid(month, year) {
  const now = new Date();
  const target = new Date(year, month - 1, 1);
  const minValid = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return target >= minValid;
}

function buildRevealInputs() {
  return {
    goalName: state.goalName,
    goalType: state.goalType,
    targetAmount: state.goalCost,
    currentSavings: state.currentSavings,
    monthlyIncome: state.monthlyIncome,
    monthlyExpenses: state.monthlyExpenses,
    targetDate: state.hasTargetDate ? new Date(state.targetYear, state.targetMonth - 1, 1) : null,
  };
}

// AI free-text goal entry (V1/B1) — pre-fills the same manual fields/state below; never
// skips a step, never auto-advances. The user always reviews/edits via the existing form.

const CATEGORY_LABELS = {
  car: 'Car',
  bike: 'Bike',
  travel: 'Trip',
  wedding: 'Wedding',
  home: 'Home',
  education: 'Education',
  electronics: 'Electronics',
  custom: 'Custom',
};

function buildGoalNameFromParse(data) {
  const parts = [data.brand, data.model, data.variant].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return CATEGORY_LABELS[data.category] || 'Custom';
}

// Fields the last successful parse pre-filled, and which of them the user has since
// changed. Feeds parse_edited — null until a parse succeeds, since editing untouched
// manual fields is not "correcting the AI".
let aiPrefilledFields = null;
let aiEditedFields = new Set();

function markFieldEdited(fieldKey) {
  if (aiPrefilledFields && aiPrefilledFields.has(fieldKey)) {
    aiEditedFields.add(fieldKey);
  }
}

function applyParsedGoal(data) {
  aiPrefilledFields = new Set(['goalName']);
  aiEditedFields = new Set();

  const goalName = buildGoalNameFromParse(data);
  state.goalName = goalName;
  state.goalType = CATEGORY_LABELS[data.category] || 'Custom';
  goalNameInput.value = goalName;

  if (isPositiveNumber(data.target_amount_inr)) {
    state.goalCost = data.target_amount_inr;
    goalCostInput.value = data.target_amount_inr;
    aiPrefilledFields.add('goalCost');
  }
  if (isNonNegativeNumber(data.current_savings_inr)) {
    state.currentSavings = data.current_savings_inr;
    currentSavingsInput.value = data.current_savings_inr;
    aiPrefilledFields.add('currentSavings');
  }
  if (isPositiveNumber(data.monthly_income_inr)) {
    state.monthlyIncome = data.monthly_income_inr;
    monthlyIncomeInput.value = data.monthly_income_inr;
    aiPrefilledFields.add('monthlyIncome');
  }
  if (isNonNegativeNumber(data.monthly_expenses_inr)) {
    state.monthlyExpenses = data.monthly_expenses_inr;
    monthlyExpensesInput.value = data.monthly_expenses_inr;
    aiPrefilledFields.add('monthlyExpenses');
  }
  if (Number.isInteger(data.timeline_months) && data.timeline_months > 0) {
    const target = new Date();
    target.setMonth(target.getMonth() + data.timeline_months);
    state.hasTargetDate = true;
    state.targetMonth = target.getMonth() + 1;
    state.targetYear = target.getFullYear();
    targetDateDetails.open = true;
    targetMonthSelect.value = String(state.targetMonth);
    targetYearInput.value = String(state.targetYear);
    aiPrefilledFields.add('targetDate');
  }
}

function showAiEntry() {
  aiGoalEntry.hidden = false;
  manualGoalFields.hidden = true;
}

function showManualFields() {
  aiGoalEntry.hidden = true;
  manualGoalFields.hidden = false;
}

if (PARSE_ENABLED) {
  showAiEntry();
}

aiManualLink.addEventListener('click', () => {
  track(EVENTS.MANUAL_FALLBACK_USED, { reason: 'user_choice' });
  showManualFields();
});

aiParseBtn.addEventListener('click', async () => {
  hideError(aiGoalError);

  const text = aiGoalTextInput.value.trim();
  if (!text) {
    showError(aiGoalError, 'Tell us what you want first.');
    return;
  }

  track(EVENTS.PARSE_ATTEMPTED, { text_length: text.length });

  aiParseBtn.disabled = true;
  const originalLabel = aiParseBtn.textContent;
  aiParseBtn.textContent = 'Thinking…';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  let data = null;
  let failureReason = 'error';
  try {
    const response = await fetch('/api/parse-goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    const json = await response.json();
    if (json && json.ok) {
      data = json.data;
    } else {
      failureReason = (json && json.reason) || 'error';
    }
  } catch (err) {
    failureReason = err.name === 'AbortError' ? 'timeout' : 'error';
  } finally {
    clearTimeout(timer);
    aiParseBtn.disabled = false;
    aiParseBtn.textContent = originalLabel;
  }

  if (data) {
    const fieldsFilledCount = Object.values(data).filter((value) => value !== null).length;
    track(EVENTS.PARSE_SUCCEEDED, { category: data.category, fields_filled_count: fieldsFilledCount });
    applyParsedGoal(data);
  } else {
    track(EVENTS.PARSE_FAILED, { reason: failureReason });
    track(EVENTS.MANUAL_FALLBACK_USED, { reason: failureReason === 'rate_limit' ? 'rate_limit' : 'api_fail' });
  }
  showManualFields();
});

// Step 1: goal + cost

startBtn.addEventListener('click', () => goToStep(1));

presetChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  fireGoalStarted();
  goalNameInput.value = chip.dataset.preset;
  goalCostInput.value = chip.dataset.cost;
  state.goalName = chip.dataset.preset;
  state.goalType = chip.dataset.preset || 'Custom';
  state.goalCost = chip.dataset.cost ? Number(chip.dataset.cost) : null;
  if (!chip.dataset.preset) goalNameInput.focus();
});
presetChips.addEventListener('click', (event) => {
  if (!event.target.closest('.chip')) return;
  markFieldEdited('goalName');
  markFieldEdited('goalCost');
});

goalNameInput.addEventListener('input', () => {
  fireGoalStarted();
  state.goalName = goalNameInput.value.trim();
});
goalNameInput.addEventListener('input', () => markFieldEdited('goalName'));

goalCostInput.addEventListener('input', () => {
  state.goalCost = goalCostInput.value === '' ? null : Number(goalCostInput.value);
});
goalCostInput.addEventListener('input', () => markFieldEdited('goalCost'));

toStep2Btn.addEventListener('click', () => {
  hideError(goalError);

  if (!state.goalName) {
    showError(goalError, 'Tell us what you want first.');
    return;
  }
  if (!isPositiveNumber(state.goalCost)) {
    showError(goalError, 'Enter a valid, positive cost.');
    return;
  }

  track(EVENTS.GOAL_DETAILS_COMPLETED);
  goToStep(2);
});

// Step 2: finances

currentSavingsInput.addEventListener('input', () => {
  state.currentSavings = currentSavingsInput.value === '' ? null : Number(currentSavingsInput.value);
});
currentSavingsInput.addEventListener('input', () => markFieldEdited('currentSavings'));

monthlyIncomeInput.addEventListener('input', () => {
  state.monthlyIncome = monthlyIncomeInput.value === '' ? null : Number(monthlyIncomeInput.value);
});
monthlyIncomeInput.addEventListener('input', () => markFieldEdited('monthlyIncome'));

monthlyExpensesInput.addEventListener('input', () => {
  state.monthlyExpenses = monthlyExpensesInput.value === '' ? null : Number(monthlyExpensesInput.value);
});
monthlyExpensesInput.addEventListener('input', () => markFieldEdited('monthlyExpenses'));

fill70Btn.addEventListener('click', () => {
  if (!isPositiveNumber(state.monthlyIncome)) return;
  const suggested = Math.round(state.monthlyIncome * 0.7);
  monthlyExpensesInput.value = suggested;
  state.monthlyExpenses = suggested;
});
fill70Btn.addEventListener('click', () => markFieldEdited('monthlyExpenses'));

targetDateDetails.addEventListener('toggle', () => {
  state.hasTargetDate = targetDateDetails.open;
});

targetMonthSelect.addEventListener('change', () => {
  state.targetMonth = Number(targetMonthSelect.value);
});
targetMonthSelect.addEventListener('change', () => markFieldEdited('targetDate'));

targetYearInput.addEventListener('input', () => {
  state.targetYear = targetYearInput.value === '' ? null : Number(targetYearInput.value);
});
targetYearInput.addEventListener('input', () => markFieldEdited('targetDate'));

toStep3Btn.addEventListener('click', () => {
  hideError(financesError);

  if (!isNonNegativeNumber(state.currentSavings)) {
    showError(financesError, 'Enter a valid amount saved so far (0 or more).');
    return;
  }
  if (!isPositiveNumber(state.monthlyIncome)) {
    showError(financesError, 'Enter a valid, positive monthly income.');
    return;
  }
  if (!isNonNegativeNumber(state.monthlyExpenses)) {
    showError(financesError, 'Enter a valid monthly expenses amount (0 or more).');
    return;
  }
  if (state.monthlyExpenses > state.monthlyIncome * 10) {
    showError(financesError, 'That expenses figure looks too high compared to your income — please check it.');
    return;
  }

  if (state.hasTargetDate) {
    if (!state.targetMonth || !isPositiveNumber(state.targetYear)) {
      showError(financesError, 'Pick a target month and year.');
      return;
    }
    if (!isTargetDateValid(state.targetMonth, state.targetYear)) {
      showError(financesError, 'Target date must be at least a month away.');
      return;
    }
  }

  track(EVENTS.FINANCES_COMPLETED);
  if (aiPrefilledFields && aiEditedFields.size > 0) {
    track(EVENTS.PARSE_EDITED, { fields_edited_count: aiEditedFields.size });
  }
  goToStep(3);

  const inputs = buildRevealInputs();
  initReveal(inputs);
  initShare(inputs);
});

// Low-key retention-intent capture — never blocks the reveal above it.
retentionForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = retentionEmailInput.value.trim();
  if (!email) return;

  track(EVENTS.RETENTION_INTENT_SUBMITTED, { email });
  identifyUser(email);

  retentionPrompt.hidden = true;
  retentionThankyou.hidden = false;
});

// Back navigation preserves entered values because the DOM inputs are never rebuilt.
backBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    goToStep(Math.max(0, state.step - 1));
  });
});

track(EVENTS.LANDING_VIEW);

// A shared link recreates the reveal directly instead of starting from the landing step.
const sharedState = decodeStateFromURL();

if (sharedState) {
  state.goalName = sharedState.goalName;
  state.goalCost = sharedState.targetAmount;
  state.currentSavings = sharedState.currentSavings;
  state.monthlyIncome = sharedState.monthlyIncome;
  state.monthlyExpenses = sharedState.monthlyExpenses;
  state.hasTargetDate = Boolean(sharedState.targetDate);

  goalNameInput.value = state.goalName;
  goalCostInput.value = state.goalCost;
  currentSavingsInput.value = state.currentSavings;
  monthlyIncomeInput.value = state.monthlyIncome;
  monthlyExpensesInput.value = state.monthlyExpenses;

  if (sharedState.targetDate) {
    state.targetMonth = sharedState.targetDate.getMonth() + 1;
    state.targetYear = sharedState.targetDate.getFullYear();
    targetDateDetails.open = true;
    targetMonthSelect.value = String(state.targetMonth);
    targetYearInput.value = String(state.targetYear);
  }

  goToStep(3);

  const inputs = buildRevealInputs();
  initReveal(inputs);
  initShare(inputs);
} else {
  goToStep(0);
}
