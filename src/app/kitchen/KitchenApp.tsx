"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { staffClient } from "@/lib/staff-client";
import { KitchenBoard, type Staff } from "./KitchenBoard";

/** Kitchen tablet: sign in, check the login belongs to shop staff, then show the live board. */
export function KitchenApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [staff, setStaff] = useState<Staff | null | undefined>(undefined);

  useEffect(() => {
    const db = staffClient();
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      setStaff(undefined);
      return;
    }
    let stopped = false;
    staffClient()
      .from("staff_users")
      .select("shop_id, name, role, is_active")
      .eq("auth_user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (stopped) return;
        const ok = data && data.is_active && (data.role === "owner" || data.role === "kitchen");
        setStaff(ok ? { shopId: data.shop_id, name: data.name, role: data.role } : null);
      });
    return () => {
      stopped = true;
    };
  }, [userId]);

  if (session === undefined || (session && staff === undefined)) {
    return <Centre>Loading…</Centre>;
  }
  if (!session) return <LoginForm />;
  if (!staff) {
    return (
      <Centre>
        <h1 data-testid="not-staff" className="font-display text-2xl text-club-green">
          This login isn&apos;t set up for the kitchen
        </h1>
        <p>Ask the owner to add you as kitchen staff.</p>
        <SignOut />
      </Centre>
    );
  }
  return <KitchenBoard staff={staff} signOut={<SignOut />} />;
}

function Centre({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">{children}</main>;
}

function SignOut() {
  return (
    <button type="button" onClick={() => staffClient().auth.signOut()} className="rounded-xl border border-club-line px-4 py-2 text-sm font-bold">
      Sign out
    </button>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await staffClient().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Email or password is wrong" : "Couldn't sign in. Check the Wi-Fi and try again.");
  };

  return (
    <Centre>
      <h1 data-testid="kitchen-login" className="font-display text-3xl text-club-green">
        Kitchen sign in
      </h1>
      <form onSubmit={submit} className="flex w-full flex-col gap-3 text-left">
        <label className="flex flex-col gap-1 font-bold">
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-club-line bg-white px-3 py-3 font-normal" />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-club-line bg-white px-3 py-3 font-normal" />
        </label>
        {error && (
          <p role="alert" className="text-sm font-bold text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="rounded-2xl bg-club-green px-4 py-3 font-bold text-club-paper disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Centre>
  );
}
