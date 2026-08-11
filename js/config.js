// Feature flags for the goal-planner app.
// PARSE_ENABLED gates the AI free-text goal entry (V1/B1). Off by default so v0 behavior is
// unchanged; flip to true and redeploy to enable (no build step, so this is a one-line edit).
export const PARSE_ENABLED = true;
