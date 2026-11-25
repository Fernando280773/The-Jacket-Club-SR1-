"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { staffClient } from "@/lib/staff-client";
import { Turnstile } from "./Turnstile";

export type StaffRole = "owner" | "kitchen" | "driver";
export type Staff = { shopId: string; name: string; role: StaffRole };

/**
 * Sign-in for the kitchen and admin pages. Shows the sign-in form until a staff member of the shop
 * with one of `roles` is signed in, then renders the page. The database's own rules still decide
 * what each login can read and change; this only decides what to show.
 */
export function StaffGate({ title, roles, children }: { title: string; roles: StaffRole[]; children: (staff: Staff, signOut: ReactNode) => ReactNode }) {
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
        setStaff(data && data.is_active ? { shopId: data.shop_id, name: data.name, role: data.role } : null);
      });
    return () => {
      stopped = true;
    };
  }, [userId]);

  if (session === undefined || (session && staff === undefined)) return <Centre>Loading…</Centre>;
  if (!session) return <LoginForm title={title} />;
  if (!staff || !roles.includes(staff.role)) {
    return (
      <Centre>
        <h1 data-testid="not-staff" className="font-display text-2xl text-club-green">
          This login can&apos;t open this page
        </h1>
        <p>{roles.includes("kitchen") ? "Ask the owner to add you as kitchen staff." : "Only the owner's login can open admin."}</p>
        <SignOut />
      </Centre>
    );
  }
  return <>{children(staff, <SignOut />)}</>;
}

function Centre({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">{children}</main>;
}

/**
 * Signs out this device only. If the login has already ended on the server (for example the same
 * person signed out somewhere else), the device is still cleared, so Sign out always works.
 */
export async function staffSignOut() {
  const auth = staffClient().auth;
  const { error } = await auth.signOut({ scope: "local" });
  if (error) {
    try {
      window.localStorage.removeItem("jc-staff-auth");
    } catch {
      // storage blocked: the reload below still shows the sign-in form once the token expires
    }
    window.location.reload();
  }
}

function SignOut() {
  return (
    <button type="button" onClick={staffSignOut} className="rounded-xl border border-club-line bg-club-paper px-4 py-2 text-sm font-bold text-club-ink">
      Sign out
    </button>
  );
}

function LoginForm({ title }: { title: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [captcha, setCaptcha] = useState<string | undefined>(undefined);
  const [captchaRound, setCaptchaRound] = useState(0);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (siteKey && !captcha) {
      setError("Please wait a moment for the security check, then try again");
      return;
    }
    setBusy(true);
    setError("");
    const { error } = await staffClient().auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken: captcha } });
    setBusy(false);
    // Each bot-check token works once: get a fresh one for the next try.
    setCaptcha(undefined);
    setCaptchaRound((n) => n + 1);
    if (error) setError(error.message === "Invalid login credentials" ? "Email or password is wrong" : "Couldn't sign in. Check the Wi-Fi and try again.");
  };

  return (
    <Centre>
      <h1 data-testid="staff-login" className="font-display text-3xl text-club-green">
        {title}
      </h1>
      <form onSubmit={submit} className="flex w-full flex-col gap-3 text-left">
        <label className="flex flex-col gap-1 font-bold">
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-club-line bg-white px-3 py-3 font-normal" />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          Password
          <input type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-club-line bg-white px-3 py-3 font-normal" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-5 w-5 accent-club-green" />
          Show password
        </label>
        {siteKey && <Turnstile key={captchaRound} siteKey={siteKey} onToken={setCaptcha} />}
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
