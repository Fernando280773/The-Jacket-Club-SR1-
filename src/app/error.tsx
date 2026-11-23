"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function MenuError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-2xl text-club-green">The Jacket Club SR1</h1>
      <p>Sorry, the menu could not be loaded right now.</p>
      <button type="button" onClick={reset} className="rounded-full bg-club-green px-4 py-2 font-bold text-club-paper">
        Try again
      </button>
    </main>
  );
}
