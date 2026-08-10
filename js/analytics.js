// PostHog init + track() wrapper + event-name constants.
// No inline event-name strings anywhere else — always import EVENTS from here.

const POSTHOG_CONFIG = {
  apiKey: 'phc_qJiTNWNsnEjRvFeLpnCuySPxpuRiiv7kA4gxWJPmQHYw', // paste your PostHog project API key here
  apiHost: 'https://us.i.posthog.com', // paste your PostHog host here
};

export const EVENTS = {
  LANDING_VIEW: 'landing_view',
  GOAL_STARTED: 'goal_started',
  GOAL_DETAILS_COMPLETED: 'goal_details_completed',
  FINANCES_COMPLETED: 'finances_completed',
  RESULT_VIEWED: 'result_viewed',
  WHATIF_USED: 'whatif_used',
  PLAN_PRESET_CLICKED: 'plan_preset_clicked',
  RESULT_SHARED: 'result_shared',
  RETENTION_INTENT_SUBMITTED: 'retention_intent_submitted',
};

// Loaded lazily, and only once a real key is pasted above — nothing fires against
// an empty project. posthog-js is pulled from a CDN since this project has no build step.
let posthogPromise = null;

function loadPostHog() {
  if (!POSTHOG_CONFIG.apiKey) return null;

  if (!posthogPromise) {
    posthogPromise = import('https://esm.sh/posthog-js@1?bundle')
      .then(({ default: posthog }) => {
        posthog.init(POSTHOG_CONFIG.apiKey, {
          api_host: POSTHOG_CONFIG.apiHost,
          person_profiles: 'identified_only',
        });
        return posthog;
      })
      .catch(() => null);
  }

  return posthogPromise;
}

export function track(eventName, props = {}) {
  const pending = loadPostHog();
  if (!pending) return;
  pending.then((posthog) => posthog && posthog.capture(eventName, props));
}

export function identifyUser(email) {
  const pending = loadPostHog();
  if (!pending) return;
  pending.then((posthog) => {
    if (!posthog) return;
    posthog.identify(email, { email });
    if (posthog.people && typeof posthog.people.set === 'function') {
      posthog.people.set({ email });
    }
  });
}
