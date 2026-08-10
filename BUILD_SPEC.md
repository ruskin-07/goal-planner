# Goal Planner — v0 Build Spec
File structure + exact prompt sequence for building with Claude Code

**Scope of v0:** public calculator, no accounts, no backend. Goal + cost → 3 financial inputs → reveal screen with live what-if sliders → share. Fully instrumented with PostHog.

**Stack decision (already made — don't let the AI change it):** plain HTML/CSS/JS with ES modules, no framework, no build step. Deployed on Vercel from a GitHub repo. Reason: you can read every line, deploys are instant, and there is nothing in v0 that needs React.

---

## 1. File structure

```
goal-planner/
├── index.html              # single page: landing → step 1 (goal) → step 2 (finances) → reveal
├── css/
│   └── style.css           # mobile-first; one file is fine at this size
├── js/
│   ├── app.js              # step navigation, state object, form validation
│   ├── calc.js             # PURE math functions only — no DOM code in this file
│   ├── whatif.js           # slider handlers → recalc → update reveal in real time
│   ├── share.js            # result-URL encode/decode + WhatsApp canvas card
│   └── analytics.js        # PostHog init + track() wrapper + event name constants
├── calculators/            # SEO wrapper pages (added weeks 3–6, folder exists from day 1)
│   ├── car.html
│   ├── wedding.html
│   └── trip.html
├── tests/
│   └── calc.test.js        # run with `node --test tests/` — guards the money math
├── assets/
│   ├── logo.svg
│   └── og-image.png        # link-preview image for shares
├── privacy.html            # short plain-language privacy note
├── NOTES.md                # AI context file — paste at start of every session
└── README.md               # setup, deploy, UTM convention
```

Rules that keep this maintainable:
- `calc.js` is pure functions (numbers in, numbers out). All formulas live here and nowhere else. This is what makes the math testable.
- `analytics.js` exports event-name constants. No string literals for events anywhere else — this is how your funnel data stays clean.
- State is one plain JS object in `app.js`. No storage APIs, no framework state.

---

## 2. The math (paste this into prompts verbatim — do not let the AI invent formulas)

Inputs: `targetAmount`, `currentSavings`, `monthlyIncome`, `monthlyExpenses`, optional `targetDate`.

```
monthlySurplus = monthlyIncome - monthlyExpenses
gap            = targetAmount - currentSavings

No-date mode (default):
  monthsNeeded  = ceil(gap / monthlySurplus)
  achieveDate   = today + monthsNeeded months

With-date mode:
  monthsLeft    = whole months between today and targetDate
  requiredMonthly = ceil(gap / monthsLeft)
  shortfall     = requiredMonthly - monthlySurplus   (can be negative = ahead)
```

v0 deliberately assumes plain saving — **no investment returns, no inflation**. (Return assumptions come later as a user-controlled input; defaulting a return % edges toward advice territory.)

Edge cases (must be handled, must be tested):
- `gap <= 0` → "You can already afford this" state
- `monthlySurplus <= 0` → "At your current pace this goal isn't reachable" + push straight into what-if sliders
- `targetDate` in the past or < 1 month away → treat as invalid, ask again
- Absurd inputs (negative numbers, expenses > 10× income) → validate, don't calculate

Hand-checked test cases for `tests/calc.test.js`:

| target | savings | income | expenses | date | expected |
|---|---|---|---|---|---|
| 10,00,000 | 1,50,000 | 60,000 | 40,000 | — | gap 8,50,000; 43 months |
| 10,00,000 | 1,50,000 | 60,000 | 40,000 | 24 mo away | required 35,417/mo; shortfall 15,417 |
| 5,00,000 | 6,00,000 | 50,000 | 30,000 | — | already achieved |
| 3,00,000 | 0 | 30,000 | 30,000 | — | unreachable state |
| 2,00,000 | 50,000 | 40,000 | 25,000 | — | gap 1,50,000; 10 months |

---

## 3. Analytics event schema (paste verbatim into Prompt 5)

```
landing_view                 on page load
goal_started                 first input in goal field
goal_details_completed       cost entered, step 1 done
finances_completed           step 2 done
result_viewed                reveal rendered   props: goalType, amountBracket, monthsNeeded, mode(date|nodate)
whatif_used                  first slider move per session   props: adjustmentCount (updated on each move)
plan_preset_clicked          props: preset(current|faster|aggressive)
result_shared                props: method(whatsapp|link)
retention_intent_submitted   email left on "monthly update?" question
```

Every inbound link you ever post carries UTM tags. Convention: `utm_source` ∈ reddit | x | linkedin | whatsapp | seo-<page> | personal.

---

## 4. Prompt sequence for Claude Code

Run these in order, one at a time, in your repo. After each one: read the diff, run it on your phone, run `node --test tests/`, commit. Don't stack prompts.

### Prompt 0 — create NOTES.md (session context)

> Create NOTES.md at the repo root with exactly this content, then follow it in all future work:
>
> "Goal Planner v0 — a public, no-login web calculator. User enters a goal + cost, then savings/income/expenses, and gets an estimated achievement date with live what-if sliders. Stack: plain HTML/CSS/JS ES modules, NO framework, NO build step, NO backend, NO browser storage APIs. Deployed on Vercel. All money math lives in js/calc.js as pure functions with tests in tests/calc.test.js (node --test). All analytics event names are constants in js/analytics.js — never inline strings. Currency is INR, formatted like ₹8,50,000. Mobile-first: most traffic is Indian mobile users. Projections are estimates, never guarantees — a disclaimer appears on every result. Never mention specific investment products, funds, stocks, or expected returns anywhere in UI copy."

### Prompt 1 — scaffold + flow shell

> Read NOTES.md. Scaffold the project with this exact file structure: [paste the tree from section 1]. Build index.html as a single-page 3-step flow with vanilla JS step navigation in js/app.js:
> Step 0 (landing): headline "Find out when you can actually afford it.", sub-line "Tell us your goal. We'll estimate your date — and show you how to move it closer.", one primary button "Start".
> Step 1 (goal): text input "What do you want?" with preset chips (Car, Bike, Trip, Wedding, House down payment, Custom) that pre-fill the goal name and a sensible default cost; editable cost field in ₹.
> Step 2 (finances): three fields — saved so far, monthly take-home income, monthly expenses. Under expenses add helper text "Not sure? A common starting point is 70% of income" with a button that fills 70%. Below, an optional collapsed section "I have a target date" revealing a month/year picker.
> Step 3 (reveal): placeholder for now.
> Keep state in one plain object. Validate per section 2 edge cases [paste edge cases]. Mobile-first CSS in css/style.css: max content width 480px, large touch targets, a single accent color, system font stack. Back navigation between steps must preserve entered values.

### Prompt 2 — the math engine + tests

> Read NOTES.md. Implement js/calc.js as pure functions implementing exactly these formulas and edge cases: [paste ALL of section 2 including the table]. Then write tests/calc.test.js using Node's built-in test runner covering every row of the test table and every edge case. Do not modify the expected values — if a test fails, the implementation is wrong, not the test. Run the tests and show me the output.

### Prompt 3 — the reveal screen + what-if sliders

> Read NOTES.md. Build the reveal (step 3) and js/whatif.js. Layout top to bottom:
> 1. The achievement date as the largest element on the screen (e.g. "March 2029"), with "At your current pace" above it. In date-mode, show instead the required monthly amount and the shortfall/surplus line.
> 2. One plain-language gap sentence, e.g. "You have ₹1,50,000 of ₹10,00,000. Saving ₹20,000/month, you're about 43 months away."
> 3. What-if sliders, live on this same screen: monthly savings (range: 0 to surplus × 2, stepped ₹500) and goal amount (±30%). Moving a slider recalculates via calc.js and animates the date changing — the update must feel instant.
> 4. Three preset buttons — Current / Faster (+25% savings) / Aggressive (+50%) — that set the savings slider.
> 5. Small print disclaimer: "Estimates based on the numbers you entered. Not financial advice."
> The unreachable-goal state must land the user directly on the sliders with the message "Move the sliders to see what would make this possible."

### Prompt 4 — share URL + WhatsApp card

> Read NOTES.md. Implement js/share.js: (1) encode the inputs into the URL query string so the reveal is recreatable from a shared link — on load, if params exist, skip straight to the reveal; version the param schema (v=1). (2) A "Share" button that renders a 1080×1920 canvas card — goal name, the big date, "Planned on Goal Planner", site URL — and offers it as a downloadable PNG plus a WhatsApp share link with the result URL. No personal financial numbers on the card image — only the goal and the date.

### Prompt 5 — analytics

> Read NOTES.md. Create js/analytics.js: initialize PostHog with key + host from a small config object at the top of the file (I'll paste real values myself), export a track(eventName, props) wrapper and event-name constants for exactly this schema: [paste all of section 3]. Wire every event at the correct trigger point across app.js, whatif.js, share.js. whatif_used fires once per session on first slider move and its adjustmentCount property updates on subsequent moves. Then list every event and the code location where it fires so I can verify.

### Prompt 6 — retention-intent capture

> Read NOTES.md. After the reveal, add a low-key card: "Want a monthly update on this date?" with an email field and Yes button. On submit, fire retention_intent_submitted and capture the email via PostHog identify/set. No backend, no storage APIs. Show a one-line thank-you. Never block or interrupt the reveal with this.

### Prompt 7 — polish + launch checklist

> Read NOTES.md. Final pass: (1) privacy.html in plain language — what's collected (entered numbers processed in-browser, analytics events, optional email) and contact address; link it in the footer. (2) OG meta tags + assets/og-image.png so shared links preview well. (3) An accessibility and mobile pass: labels on all inputs, slider usable by touch and keyboard, text readable at 360px width. (4) Give me a manual QA checklist covering every step, both modes, all four edge cases, a shared URL round-trip, and the share card on a real phone.

### Prompt 8 — deploy

> Read NOTES.md. Prepare for Vercel: verify the site is fully static, add README.md with local-run instructions (npx serve), the deploy steps (Vercel ← GitHub), the UTM convention from NOTES, and how to run tests. Confirm no secrets exist in the repo — the PostHog public key is the only key and it is safe client-side.

---

## 5. Your review checklist after every prompt

- Read the full diff. If any block is unclear, ask Claude Code to explain it line by line before committing — never merge code you couldn't explain.
- `node --test tests/` passes, untouched expected values.
- Open it on your actual phone, not just the desktop browser.
- Check the PostHog live-events view: click through the flow once and confirm each event fires exactly once with correct props.
- Commit with a message naming the prompt ("prompt-3: reveal + what-if").

## 6. Definition of done for v0

A stranger on a phone can go from landing to their date in under 90 seconds, drag a slider and watch the date move, share a link that reproduces the result, and every step of that journey shows up in your PostHog funnel. When that's true, stop building and start the Week 3 soft launch.
