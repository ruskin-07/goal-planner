// Run with `node --test tests/`.
// Do not modify the expected values — if a test fails, the implementation is wrong, not the test.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGap,
  computeMonthlySurplus,
  computeMonthsNeeded,
  addMonths,
  computeMonthsBetween,
  computeRequiredMonthly,
  computeShortfall,
  isTargetDateValid,
  validateInputs,
  calculateGoal,
} from '../js/calc.js';

const TODAY = new Date(2026, 0, 1); // Jan 2026 — fixed reference date for determinism

describe('pure math functions', () => {
  test('computeGap', () => {
    assert.equal(computeGap(1000000, 150000), 850000);
  });

  test('computeMonthlySurplus', () => {
    assert.equal(computeMonthlySurplus(60000, 40000), 20000);
  });

  test('computeMonthsNeeded rounds up', () => {
    assert.equal(computeMonthsNeeded(850000, 20000), 43);
  });

  test('computeMonthsNeeded exact division', () => {
    assert.equal(computeMonthsNeeded(150000, 15000), 10);
  });

  test('addMonths rolls year over', () => {
    const result = addMonths(TODAY, 43);
    assert.equal(result.getFullYear(), 2029);
    assert.equal(result.getMonth(), 7); // August
  });

  test('computeMonthsBetween', () => {
    assert.equal(computeMonthsBetween(TODAY, new Date(2028, 0, 1)), 24);
  });

  test('computeRequiredMonthly rounds up', () => {
    assert.equal(computeRequiredMonthly(850000, 24), 35417);
  });

  test('computeShortfall', () => {
    assert.equal(computeShortfall(35417, 20000), 15417);
  });

  test('computeShortfall can be negative (ahead of pace)', () => {
    assert.equal(computeShortfall(10000, 20000), -10000);
  });
});

describe('edge case: targetDate validity', () => {
  test('valid when exactly one month away', () => {
    assert.equal(isTargetDateValid(new Date(2026, 1, 1), TODAY), true);
  });

  test('invalid when in the past', () => {
    assert.equal(isTargetDateValid(new Date(2025, 0, 1), TODAY), false);
  });

  test('invalid when less than a month away', () => {
    assert.equal(isTargetDateValid(new Date(2026, 0, 1), TODAY), false);
  });
});

describe('edge case: absurd inputs', () => {
  test('negative targetAmount is invalid', () => {
    const result = validateInputs({
      targetAmount: -1000,
      currentSavings: 0,
      monthlyIncome: 10000,
      monthlyExpenses: 5000,
    });
    assert.equal(result.valid, false);
  });

  test('negative currentSavings is invalid', () => {
    const result = validateInputs({
      targetAmount: 1000,
      currentSavings: -1,
      monthlyIncome: 10000,
      monthlyExpenses: 5000,
    });
    assert.equal(result.valid, false);
  });

  test('expenses more than 10x income is invalid', () => {
    const result = validateInputs({
      targetAmount: 1000,
      currentSavings: 0,
      monthlyIncome: 10000,
      monthlyExpenses: 100001,
    });
    assert.equal(result.valid, false);
  });

  test('expenses exactly 10x income is valid', () => {
    const result = validateInputs({
      targetAmount: 1000,
      currentSavings: 0,
      monthlyIncome: 10000,
      monthlyExpenses: 100000,
    });
    assert.equal(result.valid, true);
  });

  test('ordinary inputs are valid', () => {
    const result = validateInputs({
      targetAmount: 1000000,
      currentSavings: 150000,
      monthlyIncome: 60000,
      monthlyExpenses: 40000,
    });
    assert.equal(result.valid, true);
  });
});

describe('calculateGoal — hand-checked test table', () => {
  test('row 1: gap 8,50,000; 43 months (no date)', () => {
    const result = calculateGoal({
      targetAmount: 1000000,
      currentSavings: 150000,
      monthlyIncome: 60000,
      monthlyExpenses: 40000,
      today: TODAY,
    });
    assert.equal(result.status, 'ok');
    assert.equal(result.mode, 'no-date');
    assert.equal(result.gap, 850000);
    assert.equal(result.monthsNeeded, 43);
    assert.equal(result.achieveDate.getFullYear(), 2029);
    assert.equal(result.achieveDate.getMonth(), 7);
  });

  test('row 2: required 35,417/mo; shortfall 15,417 (24 months away)', () => {
    const result = calculateGoal({
      targetAmount: 1000000,
      currentSavings: 150000,
      monthlyIncome: 60000,
      monthlyExpenses: 40000,
      targetDate: new Date(2028, 0, 1),
      today: TODAY,
    });
    assert.equal(result.status, 'ok');
    assert.equal(result.mode, 'with-date');
    assert.equal(result.gap, 850000);
    assert.equal(result.monthsLeft, 24);
    assert.equal(result.requiredMonthly, 35417);
    assert.equal(result.shortfall, 15417);
  });

  test('row 3: already achieved', () => {
    const result = calculateGoal({
      targetAmount: 500000,
      currentSavings: 600000,
      monthlyIncome: 50000,
      monthlyExpenses: 30000,
      today: TODAY,
    });
    assert.equal(result.status, 'already-achieved');
    assert.equal(result.gap, -100000);
  });

  test('row 4: unreachable state', () => {
    const result = calculateGoal({
      targetAmount: 300000,
      currentSavings: 0,
      monthlyIncome: 30000,
      monthlyExpenses: 30000,
      today: TODAY,
    });
    assert.equal(result.status, 'unreachable');
    assert.equal(result.gap, 300000);
    assert.equal(result.monthlySurplus, 0);
  });

  test('row 5: gap 1,50,000; 10 months', () => {
    const result = calculateGoal({
      targetAmount: 200000,
      currentSavings: 50000,
      monthlyIncome: 40000,
      monthlyExpenses: 25000,
      today: TODAY,
    });
    assert.equal(result.status, 'ok');
    assert.equal(result.mode, 'no-date');
    assert.equal(result.gap, 150000);
    assert.equal(result.monthsNeeded, 10);
  });
});

describe('calculateGoal — additional edge cases', () => {
  test('gap exactly zero counts as already achieved', () => {
    const result = calculateGoal({
      targetAmount: 500000,
      currentSavings: 500000,
      monthlyIncome: 50000,
      monthlyExpenses: 30000,
      today: TODAY,
    });
    assert.equal(result.status, 'already-achieved');
  });

  test('negative monthlySurplus is unreachable', () => {
    const result = calculateGoal({
      targetAmount: 300000,
      currentSavings: 0,
      monthlyIncome: 20000,
      monthlyExpenses: 25000,
      today: TODAY,
    });
    assert.equal(result.status, 'unreachable');
    assert.equal(result.monthlySurplus, -5000);
  });

  test('targetDate in the past is invalid input', () => {
    const result = calculateGoal({
      targetAmount: 1000000,
      currentSavings: 150000,
      monthlyIncome: 60000,
      monthlyExpenses: 40000,
      targetDate: new Date(2025, 0, 1),
      today: TODAY,
    });
    assert.equal(result.status, 'invalid-input');
  });

  test('targetDate less than a month away is invalid input', () => {
    const result = calculateGoal({
      targetAmount: 1000000,
      currentSavings: 150000,
      monthlyIncome: 60000,
      monthlyExpenses: 40000,
      targetDate: new Date(2026, 0, 1),
      today: TODAY,
    });
    assert.equal(result.status, 'invalid-input');
  });

  test('negative input amounts are invalid, not calculated', () => {
    const result = calculateGoal({
      targetAmount: -1000000,
      currentSavings: 150000,
      monthlyIncome: 60000,
      monthlyExpenses: 40000,
      today: TODAY,
    });
    assert.equal(result.status, 'invalid-input');
  });

  test('expenses more than 10x income are invalid, not calculated', () => {
    const result = calculateGoal({
      targetAmount: 1000000,
      currentSavings: 150000,
      monthlyIncome: 10000,
      monthlyExpenses: 200000,
      today: TODAY,
    });
    assert.equal(result.status, 'invalid-input');
  });
});
