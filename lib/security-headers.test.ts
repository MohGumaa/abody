import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";
import { securityHeaders } from "./security-headers";

const ALWAYS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("securityHeaders", () => {
  it("adds HSTS first in production", () => {
    expect(securityHeaders(true)).toEqual([
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
      ...ALWAYS,
    ]);
  });

  it("leaves HSTS out outside production", () => {
    expect(securityHeaders(false)).toEqual(ALWAYS);
  });

  it("sets no subdomain or preload HSTS and no Content Security Policy", () => {
    const headers = securityHeaders(true);

    for (const { value } of headers) {
      expect(value).not.toMatch(/includeSubDomains|preload/i);
    }
    expect(headers.map(({ key }) => key)).not.toContain("Content-Security-Policy");
  });
});

describe("next.config headers", () => {
  const downloads = {
    source: "/api/downloads/:path*",
    headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
  };

  it("applies the set to every path, then no-referrer to downloads", async () => {
    vi.stubEnv("NODE_ENV", "production");

    // Order matters: the later rule wins for the same header key.
    expect(await nextConfig.headers!()).toEqual([
      { source: "/:path*", headers: securityHeaders(true) },
      downloads,
    ]);
  });

  it("reads the environment when the rule is built", async () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(await nextConfig.headers!()).toEqual([
      { source: "/:path*", headers: securityHeaders(false) },
      downloads,
    ]);
  });
});
