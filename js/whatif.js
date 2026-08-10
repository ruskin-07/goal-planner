// Slider handlers → recalc via calc.js → update the reveal screen in real time.

import { calculateGoal } from './calc.js';
import { track, EVENTS } from './analytics.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatINR(amount) {
  const rounded = Math.round(amount);
  const isNegative = rounded < 0;
  const digits = String(Math.abs(rounded));
  const lastThree = digits.slice(-3);
  const other = digits.slice(0, -3);
  const groupedOther = other.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = groupedOther ? `${groupedOther},${lastThree}` : lastThree;
  return `${isNegative ? '-' : ''}₹${grouped}`;
}

function formatMonthYear(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function bucketAmount(amount) {
  if (amount < 50000) return 'under_50k';
  if (amount < 200000) return '50k_2l';
  if (amount < 500000) return '2l_5l';
  if (amount < 1000000) return '5l_10l';
  if (amount < 2500000) return '10l_25l';
  return '25l_plus';
}

let els = null;
function getEls() {
  if (els) return els;
  els = {
    eyebrow: document.getElementById('reveal-eyebrow'),
    headline: document.getElementById('reveal-headline'),
    subline: document.getElementById('reveal-subline'),
    unreachableMsg: document.getElementById('reveal-unreachable-msg'),
    gapSentence: document.getElementById('reveal-gap-sentence'),
    savingsSlider: document.getElementById('savings-slider'),
    savingsSliderValue: document.getElementById('savings-slider-value'),
    goalSlider: document.getElementById('goal-slider'),
    goalSliderValue: document.getElementById('goal-slider-value'),
    presetBtns: document.querySelectorAll('.preset-btn'),
  };
  return els;
}

let baseInputs = null;
let baseSurplus = 0;

// whatif_used fires once per session, on the first slider/preset move. adjustmentCount keeps
// counting on every move after that, even though only the first move sends the event.
let whatifAdjustmentCount = 0;
let whatifUsedFired = false;
function recordAdjustment() {
  whatifAdjustmentCount += 1;
  if (!whatifUsedFired) {
    whatifUsedFired = true;
    track(EVENTS.WHATIF_USED, { adjustmentCount: whatifAdjustmentCount });
  }
}

function adjustedInputs() {
  const el = getEls();
  const savingsValue = Number(el.savingsSlider.value);
  const goalPct = Number(el.goalSlider.value);
  return {
    ...baseInputs,
    monthlyIncome: baseInputs.monthlyExpenses + savingsValue,
    targetAmount: Math.round(baseInputs.targetAmount * (1 + goalPct / 100)),
  };
}

function pulse(el) {
  el.classList.remove('pulse');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('pulse');
}

function render(animate) {
  const el = getEls();
  const inputs = adjustedInputs();
  const result = calculateGoal(inputs);

  const savingsLabel = `${formatINR(Number(el.savingsSlider.value))}/month`;
  el.savingsSliderValue.textContent = savingsLabel;
  el.savingsSlider.setAttribute('aria-valuetext', savingsLabel);

  const goalPct = Number(el.goalSlider.value);
  const goalLabel = `${goalPct >= 0 ? '+' : ''}${goalPct}% (${formatINR(inputs.targetAmount)})`;
  el.goalSliderValue.textContent = goalLabel;
  el.goalSlider.setAttribute('aria-valuetext', goalLabel);

  el.unreachableMsg.hidden = result.status !== 'unreachable';

  if (result.status === 'already-achieved') {
    el.eyebrow.textContent = 'Good news';
    el.headline.textContent = 'You can already afford this';
    el.subline.hidden = true;
    el.gapSentence.textContent = `You have ${formatINR(inputs.currentSavings)} saved for a ${formatINR(inputs.targetAmount)} goal.`;
  } else if (result.mode === 'with-date') {
    el.eyebrow.textContent = 'To hit your date';
    el.headline.textContent = `${formatINR(result.requiredMonthly)}/month`;
    el.subline.hidden = false;
    el.subline.textContent = result.shortfall > 0
      ? `You need ${formatINR(result.shortfall)} more per month to make it.`
      : `You're ${formatINR(Math.abs(result.shortfall))} ahead of pace per month.`;
    el.gapSentence.textContent = `You have ${formatINR(inputs.currentSavings)} of ${formatINR(inputs.targetAmount)}. Saving ${formatINR(Number(el.savingsSlider.value))}/month.`;
  } else if (result.status === 'unreachable') {
    el.eyebrow.textContent = 'At your current pace';
    el.headline.textContent = "This goal isn't reachable yet";
    el.subline.hidden = true;
    el.gapSentence.textContent = `You have ${formatINR(inputs.currentSavings)} of ${formatINR(inputs.targetAmount)}.`;
  } else {
    el.eyebrow.textContent = 'At your current pace';
    el.headline.textContent = formatMonthYear(result.achieveDate);
    el.subline.hidden = true;
    el.gapSentence.textContent = `You have ${formatINR(inputs.currentSavings)} of ${formatINR(inputs.targetAmount)}. Saving ${formatINR(Number(el.savingsSlider.value))}/month, you're about ${result.monthsNeeded} months away.`;
  }

  if (animate) pulse(el.headline);
}

export function initReveal(inputs) {
  baseInputs = inputs;
  const base = calculateGoal(inputs);
  baseSurplus = inputs.monthlyIncome - inputs.monthlyExpenses;

  let monthsNeeded = null;
  if (base.status === 'already-achieved') monthsNeeded = 0;
  else if (base.mode === 'with-date') monthsNeeded = base.monthsLeft;
  else if (base.status === 'ok') monthsNeeded = base.monthsNeeded;

  track(EVENTS.RESULT_VIEWED, {
    goalType: inputs.goalType || 'Custom',
    amountBracket: bucketAmount(inputs.targetAmount),
    monthsNeeded,
    mode: inputs.targetDate ? 'date' : 'nodate',
  });

  const el = getEls();

  const sliderMax = baseSurplus > 0
    ? Math.max(500, Math.round((baseSurplus * 2) / 500) * 500)
    : Math.max(500, Math.round(inputs.monthlyIncome / 500) * 500);

  el.savingsSlider.max = String(sliderMax);
  el.savingsSlider.value = String(Math.min(Math.max(baseSurplus, 0), sliderMax));
  el.goalSlider.value = '0';

  render(false);

  if (base.status === 'unreachable') {
    el.savingsSlider.focus();
  }
}

function attachListeners() {
  const el = getEls();

  el.savingsSlider.addEventListener('input', () => {
    recordAdjustment();
    render(true);
  });
  el.goalSlider.addEventListener('input', () => {
    recordAdjustment();
    render(true);
  });

  el.presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      track(EVENTS.PLAN_PRESET_CLICKED, { preset });
      recordAdjustment();

      const multiplier = preset === 'faster' ? 1.25 : preset === 'aggressive' ? 1.5 : 1;
      const target = Math.max(0, Math.round(baseSurplus * multiplier));
      const max = Number(el.savingsSlider.max);
      el.savingsSlider.value = String(Math.min(target, max));
      render(true);
    });
  });
}

attachListeners();
