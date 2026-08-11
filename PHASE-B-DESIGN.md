# Goal Planner — PHASE-B-DESIGN.md

> Design brief only. **No implementation authority.** This document is
> handed to the coding agent for detailed proposal + implementation ONLY
> after Gate 1 (defined in VISION.md §4) is met, and only for the items
> whose evidence triggers (§2 below) have fired. It assumes the v0
> architecture as built by BUILD_SPEC.md: static HTML/CSS/JS ES modules,
> `js/calc.js` pure math engine (28 passing tests), PostHog analytics per
> the fixed event schema, share via URL params + canvas card, deployed on
> Vercel, plus the Phase A v0.5 additions (Supabase auth, `goals`,
> `progress_updates`, monthly email report).

---

## 1. Scope of Phase B

Two capabilities, each independently triggered:

**B1 — AI goal parsing.** Free-text goal entry ("I want to buy a Fortuner
in Chennai in 3 years") parsed by an LLM into structured fields that
pre-fill the existing flow.

**B2 — Curated real-goal data.** For car/bike goals: brand → model →
variant selection as product cards with estimated on-road price bands by
state, from a dataset we own and maintain.

Out of scope for Phase B (belongs to later phases): multi-goal dashboard,
AI coach/Q&A, reminders beyond the existing monthly email, travel/wedding/
home/education data, mobile packaging, any change to monetization.

## 2. Evidence triggers (checked against Gate 1 data)

- **Build B1 if:** recordings/funnel show step-1 friction (hesitation,
  typing-and-deleting, drop-off between `goal_started` and
  `goal_details_completed` above ~20%), OR a meaningful share of goal
  names entered are specific products ("Fortuner", "R15", "Swift") that
  the current chips + cost field handle poorly.
- **Build B2 if:** goal-name analytics show ≥ ~30% of goals are specific
  vehicles, OR user conversations show cost-uncertainty is blocking
  realistic target amounts.
- If neither trigger fires, Phase B is skipped and Gate 2 work proceeds
  without it. Passing Gate 1 alone builds nothing.

## 3. Architecture

```
Browser (static app, unchanged core)
   │
   ├─ /api/parse-goal   (Vercel serverless, Node)   ← B1
   │      LLM call, strict JSON out, validated server-side
   │
   ├─ /api/goal-data    (Vercel serverless, Node)   ← B2
   │      reads curated dataset (Supabase tables)
   │
   └─ Supabase (existing v0.5): auth, goals, progress_updates
              + new: products, price_bands             ← B2
```

- The static core remains the app. Serverless functions are thin edges.
- `js/calc.js` continues to run client-side, unchanged. If any server
  code ever needs the math, it imports the same module — reimplementation
  is forbidden.
- No new frontend framework. No build step unless a concrete need is
  documented and approved.

## 4. B1 — AI goal parsing design

**Endpoint:** `POST /api/parse-goal` with `{ text: string }` (max ~300
chars, enforced server-side).

**LLM contract:** single completion, temperature low, system prompt
instructs: extract ONLY the following JSON schema; if a field is absent,
return null; never add fields; never output prose.

```json
{
  "category": "car|bike|travel|wedding|home|education|electronics|custom",
  "brand": "string|null",
  "model": "string|null",
  "variant": "string|null",
  "city": "string|null",
  "target_amount_inr": "number|null",
  "current_savings_inr": "number|null",
  "monthly_income_inr": "number|null",
  "monthly_expenses_inr": "number|null",
  "timeline_months": "number|null"
}
```

**Server-side validation (non-negotiable):** response parsed and validated
against the schema (types, ranges: amounts 0–10 crore, months 1–600);
anything failing validation → the whole response is discarded and the
client falls back to the manual form. The client never receives raw LLM
text from this endpoint — JSON or nothing.

**Flow integration:** parsed fields pre-fill the existing step-1/step-2
form state; the user always sees and confirms every number before
calculation. AI output is a convenience, never an authority. Missing
fields are asked via the existing form (Phase B does not build a chat UI;
a conversational step-1 skin is allowed only if it feeds the same state
object and fires the same events).

**The LLM never**: computes gaps/timelines, mentions financial instruments,
sees or returns anything outside the schema.

## 5. B2 — Curated data layer design

**Dataset:** owned tables, not scraped feeds.

- `products(id, category, brand, model, variant, fuel, transmission,
  ex_showroom_min_inr, ex_showroom_max_inr, active, updated_at)`
- `price_bands(state_code, category, onroad_multiplier_min,
  onroad_multiplier_max, updated_at)`

Initial coverage: top ~40–60 cars + ~30 bikes by sales in the target
segment. Monthly manual refresh (founder task, ~1 hr; AI-assisted drafts
allowed, human-verified before commit). Every displayed price:
**"Estimated on-road: ₹X–Y · prices change — confirm with dealer"** and
an `updated_at` shown as "Prices as of <month>".

**Endpoint:** `GET /api/goal-data?category=car&brand=Toyota&model=Fortuner
&state=TN` → matching products with computed on-road bands. Read-only,
cacheable (CDN cache headers), no user data involved.

**UI:** product cards (name, variant, fuel/transmission, price band,
Select) replacing the bare cost field only when a known product is
identified; "Custom amount" always available. Selecting a card sets
`target_amount_inr` (band midpoint, user-editable) in the existing state.

**Interface rule:** the client calls `/api/goal-data` and knows nothing
about the source. Future sources (grounded search for long-tail, licensed
data) slot behind the same endpoint without client changes.

## 6. Security

- **Keys:** LLM provider key only in Vercel environment variables, read
  only inside serverless functions. CI/lint check that no `sk-`/key-shaped
  string ever appears in client bundles or the repo.
- **Rate limiting:** per-IP limits on `/api/parse-goal` (e.g. 10/min,
  60/day) via an edge-compatible limiter; a daily global spend cap with a
  hard-fail to manual form. `/api/goal-data` limited more loosely.
  Abuse of a free LLM proxy is assumed, not hypothetical.
- **Prompt injection:** user text is untrusted input. Mitigations, all
  required: strict JSON-schema-only output contract; server-side schema
  validation with discard-on-failure; user text placed in a delimited
  data block, never concatenated into instructions; output never rendered
  as HTML; no tool/browsing access for the parse model; length cap;
  logging of validation failures for review.
- **Supabase:** RLS on all user tables verified by test (user A cannot
  read user B's goals); `products`/`price_bands` public-read, admin-write.

## 7. Privacy implications

- v0's claim "your numbers stay in your browser" becomes partially untrue
  the day B1 ships: goal text (and any numbers the user typed into it)
  transits our serverless function and the LLM provider.
- Required in the same release: privacy.html updated in plain language
  (what leaves the browser, where it goes, that parse text is not stored
  beyond operational logs); landing reassurance line reworded honestly
  (e.g. "No sign-up needed · Manual mode never sends your numbers
  anywhere"). Manual entry must remain fully client-side.
- No parse text stored in the database. Serverless logs minimal and
  short-retention. DPDP: consent surface reviewed when accounts + parsed
  personal data intersect.

## 8. UI evolution rules (no-rewrite guarantee)

- Screen-by-screen evolution only. Phase B may touch: step 1 (parsing
  entry + product cards) and the visual polish layer (typography, accent,
  spacing). Reveal screen, what-if, share, monthly loop: untouched in
  Phase B except previously-approved polish.
- Every evolved screen feeds the existing state object and fires the
  existing events. A/B or feature-flag the new step 1 (simple flag in
  config) so it can be disabled without redeploy logic changes.
- v0 behavior remains reachable: manual form is the permanent fallback for
  API failure, rate-limit, or user preference.

## 9. Analytics additions (extend, never rename)

New events (constants in `js/analytics.js`, same conventions):

```
parse_attempted        props: text_length
parse_succeeded        props: category, fields_filled_count
parse_failed           props: reason(validation|timeout|rate_limit|error)
parse_edited           props: fields_edited_count   (user corrected AI)
product_card_viewed    props: category, brand, model
product_card_selected  props: category, brand, model, band_mid_inr
manual_fallback_used   props: reason(user_choice|api_fail|rate_limit)
```

Existing funnel events unchanged. Success criteria for B1 after launch:
parse_succeeded/parse_attempted > 85%; parse_edited rate monitored as the
honest measure of extraction quality; step-1 drop-off vs pre-B1 cohort as
the feature's justification metric — if drop-off doesn't improve, B1 is
rolled back via flag, not patched indefinitely.

## 10. Testing requirements

- `tests/calc.test.js`: untouched, still 28/28 — CI-gated.
- New `tests/parse-validation.test.js`: schema validator against a fixture
  set including valid extractions, out-of-range numbers, injection
  attempts ("ignore previous instructions…", HTML/script payloads,
  oversized input) — all must fail closed to manual form.
- New `tests/pricing.test.js`: on-road band computation from
  ex-showroom × multiplier, band ordering (min ≤ max), stale-data flag
  (updated_at > 45 days surfaces a warning in admin check).
- RLS test as §6. Manual QA checklist extended: parse happy path, every
  fallback path, flag-off path identical to v0.

## 11. Cost envelope

- Parse calls: small prompt + small output; budget ceiling set as env var;
  at free-product scale this must stay in single-digit USD/month or the
  daily cap triggers. Costs reviewed weekly during B1's first month.
- Vercel/Supabase expected to remain on free tiers through Phase B.

## 12. Open questions (resolve at Gate 1 review, before implementation)

1. Which LLM/model for parsing (cost vs. Indian-context accuracy on
   vehicle names) — benchmark 3 options on a 50-utterance fixture set.
2. Conversational skin for step 1: build now or defer to Phase C? Default:
   defer unless recordings show the form itself (not the fields) is the
   friction.
3. State detection for price bands: ask the user vs. IP-based default with
   override. Default: ask, one tap, remember for the session.
4. Seed dataset sourcing workflow: exact founder process + verification
   checklist for the monthly refresh.
