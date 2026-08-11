# Goal Planner

A public, no-login web calculator. Enter a goal + cost, then savings/income/expenses, and get an
estimated achievement date with live what-if sliders. Plain HTML/CSS/JS (ES modules) — no
framework, no build step, no backend.

## Local development

No build step, so any static file server works:

```
npx serve
```

Then open the URL it prints (usually `http://localhost:3000`). Opening `index.html` directly via
`file://` won't work — the app uses ES modules (`<script type="module">`), which browsers block
from loading over the `file://` protocol, so it needs to be served over `http://`.

## Running tests

```
node --test tests/calc.test.js
```

All money math lives in `js/calc.js` as pure functions, tested in `tests/calc.test.js` against the
hand-checked table and edge cases in `BUILD_SPEC.md`. If a test fails, the implementation is wrong,
not the test — don't edit the expected values.

> Note: on some Windows/Node combinations, `node --test tests/` (pointing at the directory) fails
> with a `MODULE_NOT_FOUND` error even though the file itself is fine. Run against the explicit
> file path above instead.

## Deploying (Vercel ← GitHub)

1. Push this repo to GitHub.
2. In Vercel: **New Project → Import** the GitHub repo.
3. Framework preset: **Other**. Leave the build command empty and the output directory as the
   project root — there's nothing to build, `index.html` is already at the root.
4. Deploy. Every subsequent push to the connected branch auto-deploys.

## Environment variables

`api/parse-goal.js` (Vercel serverless function, B1 goal parsing — off by default behind a
feature flag) requires:

```
LLM_API_KEY   Gemini API key, used server-side only in api/parse-goal.js
```

Set this in the Vercel dashboard (Project → Settings → Environment Variables) for Production
and Preview. It is read only via `process.env.LLM_API_KEY` inside the serverless function —
never sent to the browser, never committed to the repo.

## Analytics setup

`js/analytics.js` has a `POSTHOG_CONFIG` object at the top with empty `apiKey`/`apiHost` fields.
Paste your real PostHog project API key and host in there. Until a key is set, `track()` is a
no-op — no network requests are made, verified during development.

The PostHog project API key is a public, client-side key (the same one used in PostHog's own web
snippet) — safe to commit. It is the only key this project uses; there are no other secrets in the
repo.

## UTM convention

Every inbound link you post should carry UTM tags so PostHog can attribute traffic cleanly:

```
utm_source ∈ reddit | x | linkedin | whatsapp | seo-<page> | personal
```

## Before going live

- [ ] Replace the placeholder contact email in `privacy.html` (`privacy@goalplanner.app`)
- [ ] Replace the placeholder `og:url` in `index.html` with the real deployed URL
- [ ] Paste the real PostHog key/host into `js/analytics.js`
