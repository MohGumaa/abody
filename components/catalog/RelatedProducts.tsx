import Link from "next/link";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ArrowIcon } from "@/components/icons";
import { listRelatedProducts, type PublicProduct } from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

interface RelatedProductsProps {
  product: PublicProduct;
}

export async function RelatedProducts({ product }: RelatedProductsProps) {
  const locale = await getLocale();
  const related = await listRelatedProducts(product, locale);
  if (related.length === 0) {
    return null;
  }
  const { product: text } = await getDictionary();
  const listingPath =
    product.type === ProductType.SERVICE ? "/services" : "/products";

  return (
    <section
      aria-labelledby="related-heading"
      className="rounded-panel bg-panel p-5 shadow-soft min-[600px]:p-6 min-[960px]:p-10"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <h2 id="related-heading" className="text-2xl font-semibold">
          {text.related}
        </h2>
        <Link
          href={localizedPath(locale, listingPath)}
          className="inline-flex items-center gap-1 rounded-control font-semibold text-primary-strong outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong"
        >
          {text.viewAll}
          <ArrowIcon className="size-[1.1em] rtl:-scale-x-100" />
        </Link>
      </div>
      <ul className="grid gap-5 min-[600px]:grid-cols-2 min-[960px]:grid-cols-4">
        {related.map((item, index) => (
          <li key={item.id}>
            <ProductCard
              product={item}
              locale={locale}
              index={index}
              text={text}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
