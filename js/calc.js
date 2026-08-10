// Pure math functions only — no DOM code in this file.
// v0 deliberately assumes plain saving: no investment returns, no inflation.

export function computeGap(targetAmount, currentSavings) {
  return targetAmount - currentSavings;
}

export function computeMonthlySurplus(monthlyIncome, monthlyExpenses) {
  return monthlyIncome - monthlyExpenses;
}

// No-date mode
export function computeMonthsNeeded(gap, monthlySurplus) {
  return Math.ceil(gap / monthlySurplus);
}

export function addMonths(date, monthsToAdd) {
  return new Date(date.getFullYear(), date.getMonth() + monthsToAdd, 1);
}

// With-date mode
export function computeMonthsBetween(fromDate, toDate) {
  return (
    (toDate.getFullYear() - fromDate.getFullYear()) * 12 +
    (toDate.getMonth() - fromDate.getMonth())
  );
}

export function computeRequiredMonthly(gap, monthsLeft) {
  return Math.ceil(gap / monthsLeft);
}

export function computeShortfall(requiredMonthly, monthlySurplus) {
  return requiredMonthly - monthlySurplus;
}

// Edge case: targetDate in the past or < 1 month away → invalid, ask again.
export function isTargetDateValid(targetDate, today) {
  return computeMonthsBetween(today, targetDate) >= 1;
}

// Edge case: absurd inputs (negative numbers, expenses > 10x income) → validate, don't calculate.
export function validateInputs({ targetAmount, currentSavings, monthlyIncome, monthlyExpenses }) {
  const fields = { targetAmount, currentSavings, monthlyIncome, monthlyExpenses };
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      return { valid: false, reason: `${key} must be a non-negative number` };
    }
  }
  if (monthlyExpenses > monthlyIncome * 10) {
    return { valid: false, reason: 'monthlyExpenses is more than 10x monthlyIncome' };
  }
  return { valid: true, reason: null };
}

// Orchestrator: combines the formulas and edge cases above into one result.
export function calculateGoal({
  targetAmount,
  currentSavings,
  monthlyIncome,
  monthlyExpenses,
  targetDate = null,
  today = new Date(),
}) {
  const inputCheck = validateInputs({ targetAmount, currentSavings, monthlyIncome, monthlyExpenses });
  if (!inputCheck.valid) {
    return { status: 'invalid-input', reason: inputCheck.reason };
  }

  if (targetDate && !isTargetDateValid(targetDate, today)) {
    return { status: 'invalid-input', reason: 'targetDate must be in the future and at least a month away' };
  }

  const gap = computeGap(targetAmount, currentSavings);
  const monthlySurplus = computeMonthlySurplus(monthlyIncome, monthlyExpenses);

  if (gap <= 0) {
    return { status: 'already-achieved', gap, monthlySurplus };
  }

  if (targetDate) {
    const monthsLeft = computeMonthsBetween(today, targetDate);
    const requiredMonthly = computeRequiredMonthly(gap, monthsLeft);
    const shortfall = computeShortfall(requiredMonthly, monthlySurplus);
    return {
      status: monthlySurplus <= 0 ? 'unreachable' : 'ok',
      mode: 'with-date',
      gap,
      monthlySurplus,
      monthsLeft,
      requiredMonthly,
      shortfall,
    };
  }

  if (monthlySurplus <= 0) {
    return { status: 'unreachable', mode: 'no-date', gap, monthlySurplus };
  }

  const monthsNeeded = computeMonthsNeeded(gap, monthlySurplus);
  const achieveDate = addMonths(today, monthsNeeded);

  return {
    status: 'ok',
    mode: 'no-date',
    gap,
    monthlySurplus,
    monthsNeeded,
    achieveDate,
  };
}
