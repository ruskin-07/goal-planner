# Goal Planner — VISION.md

> North-star document. This file describes where the product is going and the
> evidence required before each phase is built. It is not an implementation
> spec. Nothing in this document authorizes code changes by itself — each
> phase unlocks only when its gate condition is met with real usage data.

---

## 1. What Goal Planner is

Goal Planner turns a real-world personal goal into an honest financial plan:

**GOAL → GAP → PLAN → ACTION → PROGRESS**

A person tells Goal Planner what they want. The product understands their
current situation, calculates the gap, estimates when the goal is honestly
achievable, shows how realistic changes move that date, and tracks whether
they are actually moving toward it.

The core promise: **"Find out when you can actually afford it — and what
would change that date."**

## 2. What Goal Planner is not

- Not a to-do list or generic goal tracker.
- Not an investment advisory service. Plans speak in **amounts and
  timelines only — never instruments**. No stock, fund, or asset-class
  recommendations, no default return assumptions. (SEBI RIA boundary:
  personalized investment advice requires registration we do not hold.)
- Not a commission engine. No paid placement of financial products.
  Trust is the product's core long-term asset.
- Not a chatbot with a calculator attached. AI serves the plan; the
  deterministic calculation engine (`js/calc.js`) is the only source of
  truth for financial math, in every phase, permanently.

## 3. Long-term product vision

Over time, Goal Planner becomes an AI-powered financial goal planning
platform where a user can:

1. **Create goals in natural language** — "I want to buy a Toyota Fortuner"
   — with an LLM extracting structured intent (category, brand, model,
   city, amounts, timeline) and the app asking for what's missing.
2. **Get real-world goal data** — estimated on-road car/bike prices by
   variant and city, travel cost bands, wedding/education cost references —
   from a **trusted data layer** (curated datasets first, grounded search
   for long-tail, licensed data if the product earns it). Never browser
   scraping of third-party sites.
3. **Receive a realistic plan** — gap, required monthly amount, estimated
   date — computed by the deterministic engine.
4. **Explore what-if scenarios** — more savings, changed expenses, delayed
   date — interactively and conversationally.
5. **Track progress** — monthly actuals, recalculated date, ahead/behind
   status, history charts, monthly email "reality report".
6. **Manage multiple goals** on a dashboard, with prioritization.
7. **Ask context-aware questions** — "Can I buy this sooner?" "I fell
   behind this month, what now?" — answered by an AI layer that reads the
   user's structured goal data and calls the calculation engine, with
   output constrained to amounts and timelines.
8. **Use it as a mobile app** — packaged from the same codebase
   (Capacitor-style), only after the web product is proven.

Architecture principle for all AI features, in every phase:

```
User → LLM (understand) → structured data → trusted data layer (facts)
     → calc.js (math) → result → LLM (explain, constrained) → User
```

The LLM understands and explains. It never calculates and never invents
facts or prices.

## 4. Phases and gates

Every phase below unlocks **only** when the previous gate is met with
measured data (PostHog funnel + session recordings + user conversations).
Building ahead of a gate is a process violation, not initiative.

### Phase A — Prove the core loop (current)

**Contains:** v0 public calculator (shipped) → soft launch → funnel fixes →
v0.5: accounts (Supabase, Google/magic-link), saved goals, monthly progress
update flow with date delta, monthly email reality report.

**Explicitly excluded:** everything in sections 3.1–3.8 above except what
v0 already does.

**Gate 1 (measured at ~300+ non-`personal` visitors, ≈4 weeks after
public launch):**
- Completion (landing → `result_viewed`) > 30%
- What-if engagement (`whatif_used` sessions / `result_viewed` sessions) > 50%
- Qualitative: session recordings reviewed; top friction points identified

Gate 1 failure modes: completion low → fix funnel/promise, do not add
features. Sliders ignored → interactivity thesis is weak; redesign reveal
before anything else. Can't reach 300 visitors → distribution problem;
features won't fix it.

### Phase B — AI intake + real goal data (unlocks at Gate 1)

**Contains (design brief: PHASE-B-DESIGN.md):** AI goal parsing
(`/api/parse-goal`), curated car/bike dataset with product cards, thin
serverless API layer, conversational step-1 evolution. Each item has its
own evidence trigger inside the design brief — Gate 1 passing does not
automatically build all of Phase B.

**Gate 2 (measured with 8+ weeks of signup cohorts, ≈10–12 weeks):**
- 30-day return of signed-up users > 15%
- Progress updates happening without manual prompting
- Retention-intent emails converting to actual monthly engagement

Gate 2 failure mode: returns < 10% even with the email report → the
consumer retention thesis has failed; honest pivots are (a) SEO
calculator/content business, (b) employer financial-wellness B2B. Phase C
is not built on failed retention.

### Phase C — Multi-goal platform + AI coach (unlocks at Gate 2)

**Contains:** multi-goal dashboard with per-goal progress, goal
prioritization, progress history charts, context-aware AI coach
(`/api/coach`, constrained to amounts/timelines), reminders, richer
monthly insights.

**Gate 3 (≈5–6 months):**
- Fake-door premium interest > 8% of paywall viewers at a tested price
- Retention from Gate 2 holding or improving
- First real payments collected (Razorpay) for the most-requested feature

### Phase D — Scale (unlocks at Gate 3)

**Contains:** mobile packaging (Capacitor or equivalent — same codebase,
no separate rewrite), expanded goal categories (travel, wedding, home,
education with their own data approaches), licensed/partner data sources,
employer/institution plans, Account Aggregator integration research for
automatic progress tracking.

## 5. Engineering invariants (all phases)

1. `js/calc.js` is the only place financial math happens. The LLM never
   performs arithmetic. Server-side code may import the same module, never
   reimplement it.
2. v0 remains protected: no rewrites of working, instrumented flows.
   UI evolves screen-by-screen; each evolved screen feeds the same state
   and fires the same events.
3. Analytics events are **extended, never renamed or removed**. Funnel
   continuity across versions is a product asset.
4. API keys and secrets exist only server-side (environment variables on
   serverless functions). Never in client code, never in the repo.
5. No scraping of third-party websites from the browser or server. Goal
   data comes from owned/curated datasets, clearly-framed grounded
   estimates, or licensed sources.
6. Every projection shown to users is labeled an estimate. Privacy page is
   updated in the same release as any change to where user data travels.
7. Mobile is a packaging decision, not an architecture fork. The only
   present-day obligation: keep the web app componentized and free of
   server-rendered coupling.

## 6. Retention direction (design target, built per-phase)

Reasons to return, in rough build order: monthly email reality report with
date delta (Phase A) → progress history and ahead/behind framing (Phase C)
→ AI insights and reminders (Phase C) → automatic tracking via Account
Aggregator (Phase D, research-gated). Streaks/badges are explicitly not
the strategy.

## 7. Document status

- Owner: founder. Reviewed at each gate.
- Companion documents: `BUILD_SPEC.md` (v0, shipped), `PHASE-B-DESIGN.md`
  (design brief, no implementation authority until Gate 1).
