/**
 * The public address this request came in on (for links in emails).
 * Behind a reverse proxy `req.url` is the internal address, so prefer the forwarded headers.
 */
export function siteOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return new URL(req.url).origin;
  return `${req.headers.get("x-forwarded-proto") ?? "https"}://${host}`;
}
