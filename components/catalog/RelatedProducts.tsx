import Link from "next/link";
import { ProductImage } from "@/components/catalog/ProductImage";
import {
  listRelatedProducts,
  productPath,
  type PublicProduct,
} from "@/lib/catalog";
import { localizedPath } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatPriceCents } from "@/lib/money";

interface RelatedProductsProps {
  product: PublicProduct;
}

export async function RelatedProducts({ product }: RelatedProductsProps) {
  const related = await listRelatedProducts(product);
  if (related.length === 0) {
    return null;
  }
  const locale = await getLocale();
  const dictionary = await getDictionary();

  return (
    <section aria-labelledby="related-heading" className="mt-14">
      <h2 id="related-heading" className="text-xl font-semibold">
        {dictionary.product.related}
      </h2>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((item) => (
          <li
            key={item.id}
            className="relative rounded-2xl border border-border p-4 transition-shadow focus-within:ring-2 focus-within:ring-primary-strong hover:shadow-md"
          >
            <ProductImage image={item.image} alt="" />
            <h3 dir="auto" className="mt-4 font-semibold">
              {/* The stretched link makes the whole card clickable while its
                  accessible name stays the item name. */}
              <Link
                href={localizedPath(locale, productPath(item))}
                className="outline-none after:absolute after:inset-0"
              >
                {item.name}
              </Link>
            </h3>
            <p dir="auto" className="mt-1 text-sm text-muted">
              {item.shortDescription}
            </p>
            <p className="mt-3 font-semibold">
              {formatPriceCents(item.priceCents)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
