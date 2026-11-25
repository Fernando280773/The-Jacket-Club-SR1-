"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBasket } from "@/components/BasketProvider";
import { currentOrders, orderSummary, reorderLines, shortDate, suggestions, type Account, type PastOrder } from "@/lib/account";
import { customerClient } from "@/lib/customer-client";
import type { Menu } from "@/lib/menu";
import { formatPence } from "@/lib/money";
import { currentStep, stepsFor } from "@/lib/order-status";
import { pricingMenuFrom } from "@/lib/pricing";
import { Turnstile } from "@/components/Turnstile";

const inputClass = "w-full rounded-xl border border-club-line bg-white px-4 py-3 text-base outline-none focus:border-club-green";
const buttonClass = "rounded-2xl bg-club-green px-5 py-3 font-bold text-club-paper disabled:opacity-60";
const TYPE_WORDS = { collect: "Collect", table: "Table", delivery: "Delivery" } as const;

function statusWord(o: PastOrder) {
  if (o.status === "cancelled") return "Cancelled";
  return stepsFor(o.type)[currentStep(o.type, o.status)]?.label ?? o.status;
}

export function AccountApp({ shopId, menu }: { shopId: string; menu: Pick<Menu, "categories" | "groups"> }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const auth = customerClient().auth;
    auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <p className="py-8 text-center text-club-muted">Loading…</p>;
  if (!session) return <SignIn />;
  return <Dashboard shopId={shopId} menu={menu} />;
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | undefined>(undefined);
  const [captchaRound, setCaptchaRound] = useState(0);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError("Please enter a valid email address");
    if (siteKey && !captcha) return setError("Please wait a moment for the security check, then try again");
    setBusy(true);
    setError(null);
    const { error: err } = await customerClient().auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/account`, shouldCreateUser: true, captchaToken: captcha },
    });
    setBusy(false);
    // Each bot-check token works once: get a fresh one for the next try.
    setCaptcha(undefined);
    setCaptchaRound((n) => n + 1);
    if (err) setError(err.status === 429 ? "Too many tries. Please wait a minute and try again." : "We couldn't send the email. Please try again.");
    else setSent(true);
  }

  async function google() {
    setError(null);
    const { error: err } = await customerClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/account` } });
    if (err) setError("Google sign-in isn't working right now. Please use the email link.");
  }

  if (sent) {
    return (
      <div data-testid="link-sent" role="status" className="flex flex-col gap-3 rounded-2xl bg-club-cream p-5">
        <p className="text-lg font-bold">Check your email</p>
        <p>
          We&apos;ve sent a sign-in link to <strong>{email.trim()}</strong>. Tap it and your account opens straight away. No password needed.
        </p>
        <button type="button" className="self-start text-sm font-bold underline" onClick={() => setSent(false)}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p>See your orders, order again in one tap, and check out faster. No password needed.</p>
      <button type="button" data-testid="google-sign-in" onClick={google} className="rounded-2xl border border-club-line bg-white px-5 py-3 font-bold">
        Continue with Google
      </button>
      <p className="text-center text-sm text-club-muted">or</p>
      <form onSubmit={sendLink} className="flex flex-col gap-3" noValidate>
        <label htmlFor="account-email" className="text-sm font-bold">
          Email
        </label>
        <input
          id="account-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? "account-error" : undefined}
        />
        {siteKey && <Turnstile key={captchaRound} siteKey={siteKey} onToken={setCaptcha} />}
        {error && (
          <p id="account-error" role="alert" className="text-sm font-bold text-red-700">
            {error}
          </p>
        )}
        <button type="submit" data-testid="send-link" className={buttonClass} disabled={busy}>
          {busy ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      <p className="text-xs text-club-muted">
        By signing in you agree to our <Link href="/terms" className="underline">terms</Link>. See our{" "}
        <Link href="/privacy" className="underline">privacy policy</Link> for how we use your details.
      </p>
    </div>
  );
}

function Dashboard({ shopId, menu }: { shopId: string; menu: Pick<Menu, "categories" | "groups"> }) {
  const db = customerClient();
  const basket = useBasket();
  const router = useRouter();
  const pricing = useMemo(() => pricingMenuFrom(menu), [menu]);
  const [account, setAccount] = useState<Account | null>(null);
  const [orders, setOrders] = useState<PastOrder[]>([]);
  const [popular, setPopular] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const acc = await db.rpc("customer_account", { p_shop_id: shopId });
    if (acc.error) {
      setError("We couldn't open your account. Please sign out and sign in again.");
      return;
    }
    setAccount(acc.data as Account);
    const [o, p] = await Promise.all([db.rpc("customer_orders", { p_shop_id: shopId }), db.rpc("popular_items", { p_shop_id: shopId })]);
    setOrders(((o.data as PastOrder[] | null) ?? []).filter(Boolean));
    setPopular(((p.data as { item_code: string }[] | null) ?? []).map((r) => r.item_code));
  }, [db, shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const tips = useMemo(() => suggestions(orders, menu, pricing, popular, new Date()), [orders, menu, pricing, popular]);
  const live = currentOrders(orders);

  function reorder(o: PastOrder) {
    if (!basket) return;
    const { lines, skipped } = reorderLines(o, pricing);
    if (lines.length === 0) {
      setNotice(`Sorry, nothing from order #${o.number} is available right now.`);
      return;
    }
    for (const l of lines) basket.addLine(l.itemCode, l.choices, l.quantity);
    if (skipped.length > 0) {
      setNotice(`Added to your basket. Not available right now: ${skipped.join(", ")}.`);
      return;
    }
    router.push("/basket");
  }

  // This device only: signing out here must never end the same person's staff login elsewhere.
  async function signOut() {
    const { error } = await db.auth.signOut({ scope: "local" });
    if (error) {
      try {
        window.localStorage.removeItem("jc-customer-auth");
      } catch {}
      window.location.reload();
    }
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 py-6">
        <p role="alert" className="font-bold">{error}</p>
        <button type="button" className={buttonClass} onClick={signOut}>Sign out</button>
      </div>
    );
  }
  if (!account) return <p className="py-8 text-center text-club-muted">Loading your account…</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <p data-testid="account-greeting" className="text-lg font-bold">
          Hi{account.name ? ` ${account.name.split(" ")[0]}` : ""}
        </p>
        <button type="button" data-testid="sign-out" onClick={signOut} className="rounded-full bg-club-cream px-4 py-2 text-sm font-bold">
          Sign out
        </button>
      </div>

      {basket && basket.lines.length > 0 && !notice && (
        <Link href="/checkout" data-testid="back-to-checkout" className="rounded-2xl bg-club-green px-5 py-3 text-center font-bold text-club-paper">
          Back to checkout
        </Link>
      )}

      {notice && (
        <div role="status" data-testid="account-notice" className="flex flex-col gap-2 rounded-xl bg-club-butter px-4 py-3 text-sm font-bold">
          <span>{notice}</span>
          <Link href="/basket" className="underline">Go to basket</Link>
        </div>
      )}

      {live.length > 0 && (
        <section aria-labelledby="h-current" className="flex flex-col gap-3">
          <h2 id="h-current" className="font-display text-lg text-club-green">On its way</h2>
          {live.map((o) => (
            <div key={o.id} data-testid="current-order" className="flex items-center justify-between gap-3 rounded-2xl bg-club-mint p-4">
              <div>
                <p className="font-bold">#{o.number} · {statusWord(o)}</p>
                <p className="text-sm">{orderSummary(o)}</p>
              </div>
              <Link href={`/order/${o.access_token}`} className="shrink-0 rounded-full bg-club-green px-4 py-2 text-sm font-bold text-club-paper">
                Track
              </Link>
            </div>
          ))}
        </section>
      )}

      {(tips.usual || tips.last || tips.tryNew.length > 0) && (
        <section aria-labelledby="h-for-you" className="flex flex-col gap-3">
          <h2 id="h-for-you" className="font-display text-lg text-club-green">For you</h2>
          {tips.last && (
            <div data-testid="suggest-last" className="flex items-center justify-between gap-3 rounded-2xl bg-club-cream p-4">
              <div className="min-w-0">
                <p className="font-bold">Last time you had</p>
                <p className="text-sm">{orderSummary(tips.last)}</p>
              </div>
              <button type="button" onClick={() => reorder(tips.last!)} className="shrink-0 rounded-full bg-club-green px-4 py-2 text-sm font-bold text-club-paper">
                Order again
              </button>
            </div>
          )}
          {tips.usual && (
            <div data-testid="suggest-usual" className="flex items-center justify-between gap-3 rounded-2xl bg-club-cream p-4">
              <div className="min-w-0">
                <p className="font-bold">Your usual</p>
                <p className="text-sm">{tips.usual.item.name} · ordered {tips.usual.times} times</p>
              </div>
              <button type="button" onClick={() => basket?.openItem(tips.usual!.item.code)} className="shrink-0 rounded-full bg-club-green px-4 py-2 text-sm font-bold text-club-paper">
                Add
              </button>
            </div>
          )}
          {tips.tryNew.length > 0 && (
            <div data-testid="suggest-new" className="flex flex-col gap-2 rounded-2xl bg-club-cream p-4">
              <p className="font-bold">Try something new</p>
              <ul className="flex flex-col gap-2">
                {tips.tryNew.map((i) => (
                  <li key={i.code} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{i.name} · {formatPence(i.pricePence)}</span>
                    <button type="button" onClick={() => basket?.openItem(i.code)} className="rounded-full bg-white px-3 py-1 text-sm font-bold">
                      Choose
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="h-orders" className="flex flex-col gap-3">
        <h2 id="h-orders" className="font-display text-lg text-club-green">Your orders</h2>
        {orders.length === 0 ? (
          <p data-testid="no-orders" className="text-club-muted">No orders yet. Orders you place while signed in, or with this email, show here.</p>
        ) : (
          <ul className="flex flex-col">
            {orders.map((o) => (
              <li key={o.id} data-testid="past-order" className="flex items-center justify-between gap-3 border-b border-club-line py-3">
                <div className="min-w-0">
                  <p className="font-bold">#{o.number} · {shortDate(o.created_at)} · {TYPE_WORDS[o.type]}</p>
                  <p className="truncate text-sm">{orderSummary(o)}</p>
                  <p className="text-sm text-club-muted">{formatPence(o.total_pence)} · {statusWord(o)}</p>
                </div>
                <button type="button" onClick={() => reorder(o)} className="shrink-0 rounded-full bg-club-cream px-4 py-2 text-sm font-bold">
                  Reorder
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Details shopId={shopId} account={account} onSaved={setAccount} />
      <Addresses shopId={shopId} account={account} onChange={load} />
      <DeleteAccount />
    </div>
  );
}

function Details({ shopId, account, onSaved }: { shopId: string; account: Account; onSaved: (a: Account) => void }) {
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone);
  const [marketing, setMarketing] = useState(account.marketing);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await customerClient().rpc("customer_update_account", { p_shop_id: shopId, p_name: name.trim(), p_phone: phone.trim(), p_marketing: marketing });
    setBusy(false);
    if (error) return setMsg("Couldn't save. Please check your details and try again.");
    onSaved({ ...account, name: name.trim(), phone: phone.trim(), marketing });
    setMsg("Saved");
  }

  return (
    <section aria-labelledby="h-details">
      <h2 id="h-details" className="font-display text-lg text-club-green">Your details</h2>
      <form onSubmit={save} className="mt-3 flex flex-col gap-3">
        <p className="text-sm">Email: <strong>{account.email}</strong></p>
        <label htmlFor="acc-name" className="text-sm font-bold">Name</label>
        <input id="acc-name" className={inputClass} value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        <label htmlFor="acc-phone" className="text-sm font-bold">Mobile</label>
        <input id="acc-phone" className={inputClass} value={phone} maxLength={20} type="tel" autoComplete="tel" onChange={(e) => setPhone(e.target.value)} />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" data-testid="marketing" className="mt-1 h-5 w-5" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          <span>Email me offers and news from The Jacket Club SR1. You can turn this off at any time.</span>
        </label>
        <button type="submit" data-testid="save-details" className={buttonClass} disabled={busy}>
          {busy ? "Saving…" : "Save details"}
        </button>
        {msg && <p role="status" className="text-sm font-bold">{msg}</p>}
      </form>
    </section>
  );
}

function Addresses({ shopId, account, onChange }: { shopId: string; account: Account; onChange: () => void }) {
  async function remove(id: string) {
    await customerClient().rpc("customer_delete_address", { p_shop_id: shopId, p_address_id: id });
    onChange();
  }
  return (
    <section aria-labelledby="h-addresses">
      <h2 id="h-addresses" className="font-display text-lg text-club-green">Saved delivery addresses</h2>
      {account.addresses.length === 0 ? (
        <p className="mt-2 text-sm text-club-muted">None yet. Tick &quot;Save this address&quot; at checkout when you order a delivery.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {account.addresses.map((a) => (
            <li key={a.id} data-testid="saved-address" className="flex items-center justify-between gap-3 border-b border-club-line py-3 text-sm">
              <span>{a.address}</span>
              <button type="button" onClick={() => remove(a.id)} className="shrink-0 rounded-full bg-club-cream px-3 py-1 font-bold">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DeleteAccount() {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const db = customerClient();
    const { error: err } = await db.rpc("customer_delete_account");
    if (err) return setError("We couldn't delete your account. Please email us and we'll do it for you.");
    await db.auth.signOut({ scope: "local" });
  }

  return (
    <section aria-labelledby="h-delete" className="rounded-2xl border border-club-line p-4">
      <h2 id="h-delete" className="font-bold">Delete my account</h2>
      {!asking ? (
        <button type="button" data-testid="delete-account" onClick={() => setAsking(true)} className="mt-2 text-sm font-bold text-red-700 underline">
          Delete my account
        </button>
      ) : (
        <div className="mt-2 flex flex-col gap-3 text-sm">
          <p>
            This removes your login, saved details and addresses, and can&apos;t be undone. We keep past order records for 6 years because the
            law requires it for our accounts, but they are no longer linked to you.
          </p>
          <div className="flex gap-3">
            <button type="button" data-testid="confirm-delete" onClick={remove} className="rounded-full bg-red-700 px-4 py-2 font-bold text-white">
              Yes, delete it
            </button>
            <button type="button" onClick={() => setAsking(false)} className="rounded-full bg-club-cream px-4 py-2 font-bold">
              Keep my account
            </button>
          </div>
          {error && <p role="alert" className="font-bold text-red-700">{error}</p>}
        </div>
      )}
    </section>
  );
}
