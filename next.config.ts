import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

// Safe-by-default browser headers on every page. Payments happen on Stripe's own page (redirect),
// so nothing here needs to allow Stripe frames.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; object-src 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Menu photos uploaded in admin live in Supabase Storage.
    remotePatterns: [{ protocol: "https", hostname: "quuengvoweqzaxiuowkl.supabase.co", pathname: "/storage/v1/object/public/menu-photos/**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Error alerts. Source maps are not uploaded (that would need a secret token); stack traces still show file and line.
export default withSentryConfig(nextConfig, { org: "the-jacket-club-sr1", project: "the-jacket-club-sr1", silent: true, telemetry: false, sourcemaps: { disable: true } });
