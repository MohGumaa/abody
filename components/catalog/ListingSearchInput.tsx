"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import {
  listingHref,
  type ListingSort,
  parseSearchParam,
  SEARCH_MAX_LENGTH,
} from "@/lib/listing";

// Long enough to skip most keystrokes, short enough to feel live.
const DEBOUNCE_MS = 300;

interface ListingSearchInputProps {
  basePath: string;
  category: string | null;
  q: string | null;
  sort: ListingSort;
  text: { label: string; clear: string };
}

// Searches as the customer types. Enter still submits the surrounding form,
// which also works without JavaScript.
export function ListingSearchInput({
  basePath,
  category,
  q,
  sort,
  text,
}: ListingSearchInputProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  const [value, setValue] = useState(q ?? "");
  const [pending, setPending] = useState(false);
  const [syncedQ, setSyncedQ] = useState(q);

  // An outside navigation (Clear search link, Back) changed the search: show
  // it, unless the customer is mid-typing or the field already means it.
  if (q !== syncedQ) {
    setSyncedQ(q);
    if (!pending && parseSearchParam(value) !== q) setValue(q ?? "");
  }

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  function cancel() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setPending(false);
  }

  function search(next: string) {
    const nextQ = parseSearchParam(next);
    if (nextQ === q) return;
    router.replace(listingHref(basePath, { category, q: nextQ, sort }), {
      scroll: false,
    });
  }

  function schedule(next: string) {
    cancel();
    setPending(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setPending(false);
      search(next);
    }, DEBOUNCE_MS);
  }

  function clear() {
    cancel();
    setValue("");
    search("");
    inputRef.current?.focus();
  }

  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor="listing-search" className="sr-only">
        {text.label}
      </label>
      <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        id="listing-search"
        type="search"
        name="q"
        dir="auto"
        value={value}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder={text.label}
        onChange={(event) => {
          setValue(event.target.value);
          if (!composing.current) schedule(event.target.value);
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          schedule(event.currentTarget.value);
        }}
        // Enter submits the form right away; drop the pending repeat.
        onKeyDown={(event) => {
          if (event.key === "Enter" && !composing.current) cancel();
        }}
        className="h-11 w-full rounded-control border border-border bg-surface ps-10 pe-10 text-sm text-foreground outline-offset-2 placeholder:text-faint focus-visible:outline-2 focus-visible:outline-primary-strong [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value !== "" && (
        <button
          type="button"
          onClick={clear}
          aria-label={text.clear}
          className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-control text-muted outline-offset-1 hover:bg-panel hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
