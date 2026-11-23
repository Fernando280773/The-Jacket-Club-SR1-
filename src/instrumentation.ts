import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options";

export function register() {
  Sentry.init(sentryOptions(process.env.VERCEL_ENV));
}

// Reports errors thrown while rendering pages or running server actions.
export const onRequestError = Sentry.captureRequestError;
