import { ProductCard } from "@/components/catalog/ProductCard";
import type { AdminProduct } from "@/lib/admin";
import { toPublicProduct } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";

const PREVIEWS = [
  { locale: "en", label: "English", dictionary: en },
  { locale: "ar", label: "Arabic", dictionary: ar },
] as const satisfies readonly { locale: Locale; label: string; dictionary: typeof en }[];

interface StoreCardPreviewProps {
  product: AdminProduct;
}

// The store's own card and localization, so Arabic fallbacks match the site.
export function StoreCardPreview({ product }: StoreCardPreviewProps) {
  return (
    <div className="grid gap-5">
      {PREVIEWS.map(({ locale, label, dictionary }) => (
        <figure key={locale} className="grid gap-2">
          <figcaption className="text-sm font-medium text-muted">{label}</figcaption>
          <div lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
            <ProductCard
              product={toPublicProduct(product, locale)}
              locale={locale}
              index={0}
              text={dictionary.product}
              linked={false}
            />
          </div>
        </figure>
      ))}
    </div>
  );
}
