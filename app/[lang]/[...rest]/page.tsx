import { notFound } from "next/navigation";

// With the root layout under [lang], an unmatched URL has no layout to render
// a 404 in. This catch-all sends it to the localized not-found page.
export default function UnmatchedPage() {
  notFound();
}
