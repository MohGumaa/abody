import type { ProductStatus } from "@/lib/generated/prisma/enums";

export function ProductStatusChip({ status }: { status: ProductStatus }) {
  const published = status === "PUBLISHED";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
        published ? "bg-success-soft text-success" : "bg-surface text-muted"
      }`}
    >
      {published ? "Published" : "Unpublished"}
    </span>
  );
}
