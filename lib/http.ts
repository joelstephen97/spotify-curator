import type { NextRequest } from "next/server";

/**
 * The origin the browser actually used, from the Host header — NOT req.url,
 * which Next normalizes to "localhost" in dev. Keeping redirects on the same
 * host the user is on (e.g. 127.0.0.1) is essential, because cookies set on
 * 127.0.0.1 are invisible on localhost and vice-versa.
 */
export function appBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host");
  if (!host) return new URL(req.url).origin;
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
