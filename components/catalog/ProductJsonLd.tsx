import type { PublicProduct } from "@/lib/catalog";
import { getLocale } from "@/lib/i18n/dictionaries";
import { jsonLdScript, productJsonLd, productUrl } from "@/lib/seo";

export async function ProductJsonLd({ product }: { product: PublicProduct }) {
  const data = productJsonLd(product, productUrl(product, await getLocale()));
  return (
    <script
      type="application/ld+json"
      // jsonLdScript escapes "<", so product text cannot end the script early.
      dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }}
    />
  );
}
