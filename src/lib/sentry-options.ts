// Error alerts (Sentry, EU region). The DSN is a public value: it only lets the app send error reports.
export const SENTRY_DSN = "https://26dd8adcba692a742f14a3fdfb03fc4c@o4512483029942272.ingest.de.sentry.io/4512483047374928";

/** Shared Sentry settings: report from the live site and previews only, with no personal data. */
export function sentryOptions(env: string | undefined) {
  return {
    dsn: SENTRY_DSN,
    enabled: env === "production" || env === "preview",
    environment: env ?? "development",
    sendDefaultPii: false,
    tracesSampleRate: 0,
  };
}
