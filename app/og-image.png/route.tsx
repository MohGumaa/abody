import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DEFAULT_SOCIAL_IMAGE } from "@/lib/seo";

// Generated once at build time. A route handler rather than the opengraph-image
// file convention, because pages that set their own openGraph block would drop
// a file-based image; lib/seo.ts references this URL from every page instead.
export const dynamic = "force-static";

// ImageResponse does not read oklch, so these are sRGB matches for
// --color-primary-soft and --color-primary-strong in globals.css.
const PRIMARY_SOFT = "#e9f2fc";
const PRIMARY_STRONG = "#0f64a3";
// public/Logo.png is 2063x412.
const LOGO_WIDTH = 880;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 412) / 2063);

// The bilingual logo with no other text, so one image suits both languages.
export async function GET() {
  const logo = await readFile(join(process.cwd(), "public/Logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  const { width, height } = DEFAULT_SOCIAL_IMAGE;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PRIMARY_SOFT,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only. */}
          <img src={logoSrc} width={LOGO_WIDTH} height={LOGO_HEIGHT} alt="" />
        </div>
        <div style={{ height: 24, background: PRIMARY_STRONG }} />
      </div>
    ),
    { width, height },
  );
}
