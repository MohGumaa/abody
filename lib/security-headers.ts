// Security headers on every response (feature 24c), applied by the headers()
// rule in next.config.ts. No Content Security Policy for now. Imported by the
// config outside React, so this file has no server-only marker.

export type SecurityHeader = { key: string; value: string };

// HSTS only in production: one year, no subdomains or preload until the
// domain is known (/release can add them).
export function securityHeaders(production: boolean): SecurityHeader[] {
  return [
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
  ];
}
