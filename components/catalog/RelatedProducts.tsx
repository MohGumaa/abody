import Link from "next/link";
import { ProductImage } from "@/components/catalog/ProductImage";
import {
  listRelatedProducts,
  productPath,
  type PublicProduct,
} from "@/lib/catalog";
import { formatPriceCents } from "@/lib/money";

interface RelatedProductsProps {
  product: PublicProduct;
}

export async function RelatedProducts({ product }: RelatedProductsProps) {
  const related = await listRelatedProducts(product);
  if (related.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="related-heading" className="mt-14">
      <h2 id="related-heading" className="text-xl font-semibold">
        You might also like
      </h2>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((item) => (
          <li
            key={item.id}
            className="relative rounded-2xl border border-border p-4 transition-shadow focus-within:ring-2 focus-within:ring-primary-strong hover:shadow-md"
          >
            <ProductImage image={item.image} alt="" />
            <h3 className="mt-4 font-semibold">
              {/* The stretched link makes the whole card clickable while its
                  accessible name stays the item name. */}
              <Link
                href={productPath(item)}
                className="outline-none after:absolute after:inset-0"
              >
                {item.name}
              </Link>
            </h3>
            <p className="mt-1 text-sm text-muted">{item.shortDescription}</p>
            <p className="mt-3 font-semibold">
              {formatPriceCents(item.priceCents)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
