import Link from "next/link";
import { ProductCover } from "@/components/catalog/ProductCover";
import { BoltIcon, ClockIcon } from "@/components/icons";
import { productPath, type PublicProduct } from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";
import { localizedPath, type Locale } from "@/lib/i18n/config";
import { formatPriceCents } from "@/lib/money";

export interface ProductCardText {
  instantDownload: string;
  startsAfterOnboarding: string;
}

interface ProductCardProps {
  product: PublicProduct;
  locale: Locale;
  index: number;
  text: ProductCardText;
  headingLevel?: "h2" | "h3";
}

// Shared store card. Callers load the products; the card only renders one.
// Stored content carries dir="auto" because Arabic fields fall back to English.
export function ProductCard({
  product,
  locale,
  index,
  text,
  headingLevel: Heading = "h3",
}: ProductCardProps) {
  const isService = product.type === ProductType.SERVICE;

  return (
    <article className="relative flex h-full flex-col rounded-panel border border-border bg-panel p-3 transition-[box-shadow,border-color,transform] duration-200 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-strong hover:border-primary hover:shadow-raised motion-safe:hover:-translate-y-0.5">
      {/* The title names the card, so the cover image is decorative. */}
      <ProductCover product={product} locale={locale} index={index} alt="" />
      <div className="flex flex-1 flex-col gap-3 px-2 pt-5 pb-2">
        <p
          dir="auto"
          className="text-xs font-semibold tracking-[0.06em] text-primary-strong uppercase"
        >
          {product.category}
        </p>
        <Heading dir="auto" className="text-lg font-semibold break-words">
          {/* The stretched link makes the whole card clickable while its
              accessible name stays the item name. */}
          <Link
            href={localizedPath(locale, productPath(product))}
            className="outline-none after:absolute after:inset-0"
          >
            {product.name}
          </Link>
        </Heading>
        <p dir="auto" className="text-sm break-words text-muted">
          {product.shortDescription}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          <span className="text-lg font-bold">
            {formatPriceCents(product.priceCents)}
          </span>
          {isService ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-xs font-semibold whitespace-nowrap text-primary-strong">
              <ClockIcon className="size-[1.25em]" />
              {text.startsAfterOnboarding}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-xs font-semibold whitespace-nowrap text-success">
              <BoltIcon className="size-[1.25em]" />
              {text.instantDownload}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
