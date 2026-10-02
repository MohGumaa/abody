import { AddToCartButton } from "@/components/catalog/AddToCartButton";
import { ProductImage } from "@/components/catalog/ProductImage";
import { RelatedProducts } from "@/components/catalog/RelatedProducts";
import { formatDurationDays, type PublicProduct } from "@/lib/catalog";
import { ProductType } from "@/lib/generated/prisma/enums";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatPriceCents } from "@/lib/money";

interface ProductDetailProps {
  product: PublicProduct;
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="mt-0.5 h-5 w-5 shrink-0 text-primary"
    >
      <path
        d="m4.5 10.5 3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Stored product content is one language until bilingual content ships, so it
// carries dir="auto" to keep its own alignment and punctuation on Arabic pages.
export async function ProductDetail({ product }: ProductDetailProps) {
  const locale = await getLocale();
  const { product: text } = await getDictionary();
  const isService = product.type === ProductType.SERVICE;
  const included = product.included.filter((line) => line.trim() !== "");
  const durationDays =
    isService && product.durationDays && product.durationDays > 0
      ? product.durationDays
      : null;
  const requirements =
    isService && product.requirements?.trim() ? product.requirements : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 font-sans sm:px-6 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductImage image={product.image} alt={product.name} />

        <div>
          <p className="text-sm font-medium text-primary-strong">
            {text.typeLabels[product.type]}
            <span className="text-muted">
              {" · "}
              <span dir="auto">{product.category}</span>
            </span>
          </p>
          <h1
            dir="auto"
            className="mt-2 text-3xl font-semibold tracking-tight break-words sm:text-4xl"
          >
            {product.name}
          </h1>
          <p className="mt-4 text-3xl font-semibold">
            {formatPriceCents(product.priceCents)}
          </p>
          {durationDays && (
            <p className="mt-1 text-sm text-muted">
              {text.duration}: {formatDurationDays(durationDays, locale)}
            </p>
          )}
          <p dir="auto" className="mt-4 text-lg leading-7 text-muted">
            {product.shortDescription}
          </p>

          <div className="mt-8">
            <AddToCartButton />
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4 shrink-0"
            >
              <rect
                x="4"
                y="9"
                width="12"
                height="8"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M7 9V6.5a3 3 0 0 1 6 0V9"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            {text.securePayment}
          </p>
        </div>
      </div>

      <div className="mt-12 grid gap-10 border-t border-border pt-10 lg:grid-cols-2 lg:gap-12">
        <section aria-labelledby="description-heading">
          <h2 id="description-heading" className="text-xl font-semibold">
            {text.description}
          </h2>
          <p
            dir="auto"
            className="mt-4 leading-7 break-words whitespace-pre-line"
          >
            {product.description}
          </p>
        </section>

        {included.length > 0 && (
          <section aria-labelledby="included-heading">
            <h2 id="included-heading" className="text-xl font-semibold">
              {text.included}
            </h2>
            <ul className="mt-4 space-y-3">
              {included.map((line, index) => (
                <li key={index} className="flex gap-3">
                  <CheckIcon />
                  <span dir="auto" className="min-w-0 break-words">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {requirements && (
          <section aria-labelledby="requirements-heading">
            <h2 id="requirements-heading" className="text-xl font-semibold">
              {text.requirements}
            </h2>
            <p
              dir="auto"
              className="mt-4 leading-7 break-words whitespace-pre-line"
            >
              {requirements}
            </p>
          </section>
        )}
      </div>

      <section
        aria-labelledby="how-it-works-heading"
        className="mt-12 rounded-2xl bg-surface p-6 sm:p-8"
      >
        <h2 id="how-it-works-heading" className="text-xl font-semibold">
          {text.howItWorks}
        </h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {text.steps[product.type].map((step, index) => (
            <li key={step} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-strong text-sm font-semibold text-white"
              >
                {index + 1}
              </span>
              <span className="font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <RelatedProducts product={product} />
    </main>
  );
}
