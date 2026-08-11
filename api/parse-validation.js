// Pure validator for the /api/parse-goal extraction contract — shared by api/parse-goal.js
// and tests/parse-validation.test.js. No I/O, no LLM calls: given raw text as if it came back
// from the model, either produces a validated, rebuilt object or null (fail closed).

const CATEGORIES = ['car', 'bike', 'travel', 'wedding', 'home', 'education', 'electronics', 'custom'];
const MIN_AMOUNT = 0;
const MAX_AMOUNT = 100000000;
const MIN_MONTHS = 1;
const MAX_MONTHS = 600;

const SCHEMA_KEYS = [
  'category', 'brand', 'model', 'variant', 'city',
  'target_amount_inr', 'current_savings_inr', 'monthly_income_inr',
  'monthly_expenses_inr', 'timeline_months',
];
const ALLOWED_KEYS = new Set(SCHEMA_KEYS);

function isNullableString(value) {
  return value === null || typeof value === 'string';
}

function isNullableAmount(value) {
  if (value === null) return true;
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_AMOUNT && value <= MAX_AMOUNT;
}

function isNullableMonths(value) {
  if (value === null) return true;
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_MONTHS && value <= MAX_MONTHS;
}

// Validates an already-parsed candidate object against the extraction contract and rebuilds
// a clean object from known fields only — fails closed (null) on any deviation: unknown keys,
// wrong types, out-of-range values. Never passes the candidate object through as-is.
function validateExtraction(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;

  const keys = Object.keys(candidate);
  if (keys.length !== ALLOWED_KEYS.size || keys.some((key) => !ALLOWED_KEYS.has(key))) return null;

  if (!CATEGORIES.includes(candidate.category)) return null;
  if (!isNullableString(candidate.brand)) return null;
  if (!isNullableString(candidate.model)) return null;
  if (!isNullableString(candidate.variant)) return null;
  if (!isNullableString(candidate.city)) return null;
  if (!isNullableAmount(candidate.target_amount_inr)) return null;
  if (!isNullableAmount(candidate.current_savings_inr)) return null;
  if (!isNullableAmount(candidate.monthly_income_inr)) return null;
  if (!isNullableAmount(candidate.monthly_expenses_inr)) return null;
  if (!isNullableMonths(candidate.timeline_months)) return null;

  return {
    category: candidate.category,
    brand: candidate.brand,
    model: candidate.model,
    variant: candidate.variant,
    city: candidate.city,
    target_amount_inr: candidate.target_amount_inr,
    current_savings_inr: candidate.current_savings_inr,
    monthly_income_inr: candidate.monthly_income_inr,
    monthly_expenses_inr: candidate.monthly_expenses_inr,
    timeline_months: candidate.timeline_months,
  };
}

// Parses raw model text as JSON, then validates it. Combines both fail-closed steps the API
// route needs: JSON.parse can throw (non-JSON, markdown-fenced JSON, prose) and
// validateExtraction can return null (schema violations). Either failure returns null.
function parseAndValidateExtraction(rawText) {
  let candidate;
  try {
    candidate = JSON.parse(rawText);
  } catch (err) {
    return null;
  }
  return validateExtraction(candidate);
}

module.exports = {
  CATEGORIES,
  MIN_AMOUNT,
  MAX_AMOUNT,
  MIN_MONTHS,
  MAX_MONTHS,
  SCHEMA_KEYS,
  validateExtraction,
  parseAndValidateExtraction,
};
