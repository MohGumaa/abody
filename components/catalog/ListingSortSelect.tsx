"use client";

import type { ListingSort } from "@/lib/listing";

interface ListingSortSelectProps {
  value: ListingSort;
  options: { value: ListingSort; label: string }[];
  className: string;
}

// Applies the sort as soon as it changes. Without JavaScript the form's
// submit button applies it instead.
export function ListingSortSelect({
  value,
  options,
  className,
}: ListingSortSelectProps) {
  return (
    <select
      name="sort"
      defaultValue={value}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
