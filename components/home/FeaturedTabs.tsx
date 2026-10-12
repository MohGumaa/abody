"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

export interface FeaturedTab {
  id: string;
  label: string;
  // Rendered on the server; this component only shows or hides it.
  panel: ReactNode;
}

interface FeaturedTabsProps {
  // The section title and intro, laid out opposite the tabs.
  head: ReactNode;
  label: string;
  dir: "ltr" | "rtl";
  tabs: FeaturedTab[];
}

// WAI-ARIA tabs with automatic activation: arrow keys move and select.
export function FeaturedTabs({ head, label, dir, tabs }: FeaturedTabsProps) {
  const baseId = useId();
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    setSelected(index);
    buttons.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1;
    // Arrows follow the visual order, which mirrors in Arabic.
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next: number;
    if (event.key === forward) next = selected === last ? 0 : selected + 1;
    else if (event.key === back) next = selected === 0 ? last : selected - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    select(next);
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        {head}
        <div
          role="tablist"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="flex flex-wrap gap-2"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={index === selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={index === selected ? 0 : -1}
              onClick={() => select(index)}
              className="cursor-pointer rounded-full border border-border bg-panel px-4 py-2 text-sm font-medium text-muted outline-offset-2 hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong aria-[selected=true]:border-primary-strong aria-[selected=true]:bg-primary-strong aria-[selected=true]:text-white"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={index !== selected}
        >
          {tab.panel}
        </div>
      ))}
    </>
  );
}
