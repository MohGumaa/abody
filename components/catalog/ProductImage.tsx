import { publicImageSrc } from "@/lib/catalog";

interface ProductImageProps {
  image: string | null;
  alt: string;
}

export function ProductImage({ image, alt }: ProductImageProps) {
  const src = publicImageSrc(image);

  return (
    <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-surface">
      {src ? (
        // next/image needs every remote host configured, and file storage is
        // not chosen yet, so image URLs can point at any https host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full items-center justify-center text-border"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-16 w-16">
            <rect
              x="3"
              y="4"
              width="18"
              height="16"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="9" cy="10" r="1.75" fill="currentColor" />
            <path
              d="m4 17 5-4.5 3.5 3 3-2.5L20 17"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
