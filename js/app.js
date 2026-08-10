// Step navigation, state object, and form validation for the 3-step flow.
// All money math is delegated to calc.js — this file never invents formulas.

import { initReveal } from './whatif.js';
import { decodeStateFromURL, initShare } from './share.js';
import { track, identifyUser, EVENTS } from './analytics.js';

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

goalNameInput.addEventListener('input', () => {
  fireGoalStarted();
  state.goalName = goalNameInput.value.trim();
});

goalCostInput.addEventListener('input', () => {
  state.goalCost = goalCostInput.value === '' ? null : Number(goalCostInput.value);
});

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

monthlyIncomeInput.addEventListener('input', () => {
  state.monthlyIncome = monthlyIncomeInput.value === '' ? null : Number(monthlyIncomeInput.value);
});

monthlyExpensesInput.addEventListener('input', () => {
  state.monthlyExpenses = monthlyExpensesInput.value === '' ? null : Number(monthlyExpensesInput.value);
});

fill70Btn.addEventListener('click', () => {
  if (!isPositiveNumber(state.monthlyIncome)) return;
  const suggested = Math.round(state.monthlyIncome * 0.7);
  monthlyExpensesInput.value = suggested;
  state.monthlyExpenses = suggested;
});

targetDateDetails.addEventListener('toggle', () => {
  state.hasTargetDate = targetDateDetails.open;
});

targetMonthSelect.addEventListener('change', () => {
  state.targetMonth = Number(targetMonthSelect.value);
});

targetYearInput.addEventListener('input', () => {
  state.targetYear = targetYearInput.value === '' ? null : Number(targetYearInput.value);
});

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
