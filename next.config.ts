import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "production"),
      },
      // Next.js keeps a config header over a route's own header with the same
      // name, so the download redirect's no-referrer (signed bucket URLs) is
      // set here. Later rules win.
      {
        source: "/api/downloads/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
