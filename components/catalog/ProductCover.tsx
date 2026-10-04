import { BoltIcon, ChartIcon } from "@/components/icons";
import {
  formatDurationDays,
  publicImageSrc,
  type PublicProduct,
} from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";

// Placeholder covers cycle through the mockup tints by position.
const PRODUCT_TINTS = ["bg-tint-1", "bg-tint-2", "bg-tint-3", "bg-tint-4"];

interface ProductCoverProps {
  product: PublicProduct;
  locale: Locale;
  index: number;
  // Empty when a nearby heading already names the item.
  alt: string;
}

// The 4:3 cover shared by the store card and the detail page.
export function ProductCover({ product, locale, index, alt }: ProductCoverProps) {
  const isService = product.type === ProductType.SERVICE;
  const src = publicImageSrc(product.image);
  const durationDays =
    isService && product.durationDays && product.durationDays > 0
      ? product.durationDays
      : null;
  const coverColor = isService
    ? "bg-ink"
    : PRODUCT_TINTS[index % PRODUCT_TINTS.length];

  return (
    <div
      className={`relative grid aspect-[4/3] place-items-center overflow-hidden rounded-card ${coverColor}`}
    >
      {src ? (
        // Same reason as ProductImage: image hosts are not configured yet.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      ) : isService ? (
        <span
          aria-hidden="true"
          className="grid aspect-square w-[30%] place-items-center rounded-full bg-primary-strong text-white"
        >
          <ChartIcon className="size-1/2" />
        </span>
      ) : (
        <>
          <span
            aria-hidden="true"
            className="absolute aspect-[3/4] w-[34%] translate-x-[18%] rotate-[8deg] rounded-control bg-panel/55"
          />
          <span
            aria-hidden="true"
            className="relative grid aspect-[3/4] w-[34%] -rotate-[4deg] place-items-center rounded-control bg-panel text-primary shadow-raised"
          >
            <BoltIcon className="size-2/5" />
          </span>
        </>
      )}
      {durationDays && (
        <span className="absolute start-3 top-3 rounded-full bg-panel px-3 py-1 text-xs font-semibold whitespace-nowrap text-muted">
          {formatDurationDays(durationDays, locale)}
        </span>
      )}
    </div>
  );
}
